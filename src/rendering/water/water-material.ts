import {
  abs,
  attribute,
  cameraPosition,
  clamp,
  distance,
  dot,
  float,
  floor,
  fract,
  ivec2,
  length,
  max,
  min,
  mix,
  mx_noise_float,
  normalize,
  positionWorld,
  pow,
  select,
  smoothstep,
  textureLoad,
  time,
  transformNormalToView,
  uniform,
  varying,
  vec2,
  vec3,
} from "three/tsl";
import { Color, MeshStandardNodeMaterial, type Node, Vector2 } from "three/webgpu";
import { NO_WATER } from "../../world/water.ts";
import type { WorldGrid } from "../../world/world-grid.ts";
import { sampleHeightNode } from "../terrain/height-sampling.ts";
import type { TerrainTextures } from "../terrain/terrain-textures.ts";

const PRESENT_LEVEL = NO_WATER / 2;
const HIDDEN_DEPTH = 40;
const BANK_SINK = 0.3;
const SHORE_FADE = 0.2;
const SHORE_WOBBLE = 0.32;
const WAVE_SAMPLE_STEP = 0.35;
const COARSE_LIFT = 0.4;
const FOAM_FAR = 900;
const FOAM_NEAR = 250;

export class WaterLook {
  readonly daylight = uniform(1);
  readonly horizonColor = uniform(new Color(0xcf_e2_f0));
  readonly windTravel = uniform(new Vector2());
  readonly zenithColor = uniform(new Color(0x4c_8c_d6));
}

function waveHeight(point: Node<"vec2">): Node<"float"> {
  const broad = mx_noise_float(vec3(point.mul(0.16), time.mul(0.32)));
  const fine = mx_noise_float(vec3(point.mul(0.53), time.mul(0.61)));

  return broad.add(fine.mul(0.42));
}

function waveNormal(point: Node<"vec2">, strength: Node<"float">): Node<"vec3"> {
  const center = waveHeight(point);
  const east = waveHeight(point.add(vec2(WAVE_SAMPLE_STEP, 0)));
  const south = waveHeight(point.add(vec2(0, WAVE_SAMPLE_STEP)));

  return normalize(vec3(center.sub(east).mul(strength), WAVE_SAMPLE_STEP, center.sub(south).mul(strength)));
}

export function createWaterMaterial(
  textures: TerrainTextures,
  grid: WorldGrid,
  look: WaterLook
): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial({ transparent: true });
  const last = grid.cellsPerSide - 1;
  const cellSize = float(grid.cellSize);
  const halfSize = float(grid.halfSize);

  const cell = clamp(attribute("origin", "vec2").add(attribute("cell", "vec2")), vec2(0, 0), vec2(last, last));

  const levelAt = (offsetX: number, offsetZ: number) =>
    textureLoad(textures.water, ivec2(clamp(cell.add(vec2(offsetX, offsetZ)), vec2(0, 0), vec2(last, last)))).x;

  const own = levelAt(0, 0);
  const east = levelAt(1, 0);
  const west = levelAt(-1, 0);
  const south = levelAt(0, 1);
  const north = levelAt(0, -1);
  const ground = textureLoad(textures.height, ivec2(cell)).x;

  const diagonalLevel = max(max(levelAt(1, 1), levelAt(-1, -1)), max(levelAt(1, -1), levelAt(-1, 1)));

  const neighborLevel = max(max(max(east, west), max(south, north)), diagonalLevel);
  const isOwnWater = own.greaterThan(PRESENT_LEVEL);
  const bankAverage = averageWetLevel([east, west, south, north]);
  const hasEastWestWater = east.greaterThan(PRESENT_LEVEL).and(west.greaterThan(PRESENT_LEVEL));
  const hasNorthSouthWater = south.greaterThan(PRESENT_LEVEL).and(north.greaterThan(PRESENT_LEVEL));

  const isNearWater = neighborLevel.greaterThan(PRESENT_LEVEL);
  const bankLevel = min(
    select(bankAverage.greaterThan(PRESENT_LEVEL), bankAverage, neighborLevel),
    ground.sub(BANK_SINK)
  );
  const slope = vec2(
    select(hasEastWestWater, west.sub(east), float(0)),
    select(hasNorthSouthWater, north.sub(south), float(0))
  ).div(cellSize.mul(2));

  const step = attribute("patchStep", "float");
  const pooledAt = (index: number) => textureLoad(textures.pooledWater[index], ivec2(cell)).x;

  const pooled = select(step.greaterThan(6), pooledAt(2), select(step.greaterThan(3), pooledAt(1), pooledAt(0)));

  const isCoarse = step.greaterThan(1.5);
  const coarseLevel = max(pooled, ground.add(COARSE_LIFT));

  const level = select(
    isOwnWater,
    own,
    select(
      isCoarse.and(pooled.greaterThan(PRESENT_LEVEL)),
      coarseLevel,
      select(isNearWater, bankLevel, ground.sub(HIDDEN_DEPTH))
    )
  );

  material.positionNode = vec3(
    cell.x.add(0.5).mul(cellSize).sub(halfSize),
    level,
    cell.y.add(0.5).mul(cellSize).sub(halfSize)
  );

  const fullDetail = varying(select(step.lessThan(1.5), float(1), float(0)), "waterDetail");
  const flow = varying(slope, "waterFlow");
  const viewDirection = normalize(cameraPosition.sub(positionWorld));
  const bed = sampleHeightNode(textures.height, grid, positionWorld.xz);
  const shoreWobble = mx_noise_float(vec3(positionWorld.xz.mul(0.09), 3.7))
    .add(mx_noise_float(vec3(positionWorld.xz.mul(0.37), 8.1)).mul(0.35))
    .mul(SHORE_WOBBLE);

  const shoreDepth = positionWorld.y.sub(bed).add(shoreWobble);
  const normal = surfaceNormal(flow, look);

  const depth = max(shoreDepth, 0);

  material.maskNode = isWetAround(textures, grid, positionWorld.xz).and(
    fullDetail.lessThan(0.5).or(shoreDepth.greaterThan(0))
  );
  material.normalNode = transformNormalToView(normal);

  const fresnel = pow(float(1).sub(max(dot(normal, viewDirection), 0)), 4);
  const foamNoise = mx_noise_float(vec3(positionWorld.xz.mul(0.7), time.mul(0.4)))
    .mul(0.5)
    .add(0.5);

  const foamDetail = smoothstep(FOAM_FAR, FOAM_NEAR, distance(positionWorld, cameraPosition));
  const steadyFoam = mix(float(0.5), foamNoise, foamDetail);
  const shoreFoam = smoothstep(0.45, 0, depth)
    .mul(fullDetail)
    .mul(smoothstep(0.25, 0.75, steadyFoam));
  const rapidsFoam = smoothstep(0.1, 0.3, length(flow)).mul(smoothstep(0.45, 0.85, steadyFoam));

  const foam = clamp(shoreFoam.add(rapidsFoam), 0, 1);

  const body = mix(vec3(0.16, 0.42, 0.42), vec3(0.03, 0.13, 0.2), smoothstep(0.2, 6, depth));
  const sky = mix(look.horizonColor, look.zenithColor, 0.35);

  material.colorNode = mix(body, vec3(0.93, 0.96, 0.97), foam);
  material.emissiveNode = sky.mul(fresnel).mul(look.daylight.mul(0.75).add(0.1)).mul(float(1).sub(foam));
  material.opacityNode = clamp(
    mix(float(0.42), float(0.94), smoothstep(0, 3.5, depth))
      .add(foam.mul(0.5))
      .add(fresnel.mul(0.3)),
    0,
    1
  ).mul(mix(float(1), smoothstep(0, SHORE_FADE, shoreDepth), fullDetail));
  material.roughnessNode = mix(float(0.06), float(0.5), foam);
  material.metalnessNode = float(0);

  return material;
}

function averageWetLevel(levels: readonly Node<"float">[]): Node<"float"> {
  let total: Node<"float"> = float(0);
  let count: Node<"float"> = float(0);

  for (const level of levels) {
    const isWet = level.greaterThan(PRESENT_LEVEL);

    total = total.add(select(isWet, level, float(0)));
    count = count.add(select(isWet, float(1), float(0)));
  }

  return select(count.greaterThan(0), total.div(max(count, 1)), float(NO_WATER));
}

function isWetAround(textures: TerrainTextures, grid: WorldGrid, point: Node<"vec2">): Node<"bool"> {
  const last = grid.cellsPerSide - 1;
  const base = floor(point.add(grid.halfSize).div(grid.cellSize).sub(0.5));

  const levelAt = (column: number, row: number) =>
    textureLoad(textures.water, ivec2(clamp(base.add(vec2(column, row)), vec2(0, 0), vec2(last, last)))).x;

  const highest = max(max(levelAt(0, 0), levelAt(1, 0)), max(levelAt(0, 1), levelAt(1, 1)));

  return highest.greaterThan(PRESENT_LEVEL);
}

function surfaceNormal(flow: Node<"vec2">, look: WaterLook): Node<"vec3"> {
  const speed = clamp(length(flow).mul(55), 0, 3);
  const direction = select(length(flow).greaterThan(0.0001), normalize(flow), vec2(0, 0));

  const cycle = time.mul(0.22);
  const calming = smoothstep(1800, 150, distance(positionWorld, cameraPosition)).mul(0.85).add(0.15);

  const phase = fract(cycle);
  const otherPhase = fract(cycle.add(0.5));

  const drift = look.windTravel;
  const travel = direction.mul(speed).mul(7);
  const blend = abs(phase.mul(2).sub(1));
  const strength = float(1.1).add(speed.mul(0.6)).mul(calming);

  const pointA = positionWorld.xz.sub(drift).sub(travel.mul(phase));
  const pointB = positionWorld.xz.sub(drift).sub(travel.mul(otherPhase)).add(vec2(13.7, 4.1));

  return normalize(mix(waveNormal(pointA, strength), waveNormal(pointB, strength), blend));
}
