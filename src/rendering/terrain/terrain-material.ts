import {
  attribute,
  clamp,
  Fn,
  float,
  fwidth,
  If,
  ivec2,
  max,
  min,
  mix,
  mx_fractal_noise_float,
  mx_noise_float,
  normalize,
  normalLocal,
  normalWorld,
  positionWorld,
  select,
  sin,
  smoothstep,
  texture,
  textureLoad,
  time,
  vec2,
  vec3,
} from "three/tsl";
import { MeshStandardNodeMaterial, type Node } from "three/webgpu";
import type { WorldGrid } from "../../world/world-grid.ts";
import { type FireGlow, fireLightAt } from "../effects/fire-glow.ts";
import { unitNoise } from "../node-helpers.ts";
import { sampleCellsNode } from "./height-sampling.ts";
import type { TerrainTextures } from "./terrain-textures.ts";

const SKIRT_DROP_PER_STEP = 25;
const EDGE_SKIRT_INSET = 3;
const CHARCOAL = vec3(0.012, 0.011, 0.01);
const ASH = vec3(0.13, 0.12, 0.11);
const EMBER_DEEP = vec3(1.2, 0.24, 0.03);
const EMBER_BRIGHT = vec3(1.3, 0.42, 0.06);
const GROUND_FIRE_LIGHT = 0.6;
const EMBER_THRESHOLD = 0.004;

function emberGlow(fire: Node<"float">, point: Node<"vec2">, grain: Node<"float">): Node<"vec3"> {
  return Fn(() => {
    const glow = vec3(0).toVar();

    If(fire.greaterThan(EMBER_THRESHOLD), () => {
      glow.assign(burningGlow(fire, point, grain));
    });

    return glow;
  })();
}

function burningGlow(fire: Node<"float">, point: Node<"vec2">, grain: Node<"float">): Node<"vec3"> {
  const flicker = unitNoise(point.mul(0.35).add(vec2(time.mul(1.3), time.mul(-0.9))))
    .mul(0.4)
    .add(0.6);
  const embers = smoothstep(0.35, 0.8, unitNoise(point.mul(0.6)).mul(0.6).add(grain.mul(0.4)));

  const smoulder = smoothstep(0.02, 0.35, fire).mul(embers.mul(1.1).add(0.08)).mul(flicker);
  const blaze = fire.mul(fire).mul(embers.mul(0.8).add(0.2));

  return EMBER_DEEP.mul(smoulder).add(EMBER_BRIGHT.mul(blaze));
}

function edgeSide(coordinate: Node<"float">, lastCell: number): Node<"float"> {
  return select(
    coordinate.lessThan(0.5),
    float(-1),
    select(coordinate.greaterThan(lastCell - 0.5), float(1), float(0))
  );
}

function terrainPosition(textures: TerrainTextures, grid: WorldGrid, plinth: number): Node<"vec3"> {
  const cellSize = float(grid.cellSize);
  const halfSize = float(grid.halfSize);
  const lastCell = grid.cellsPerSide - 1;

  const origin = attribute("origin", "vec2");
  const localCell = attribute("cell", "vec2");
  const skirt = attribute("skirt", "float");

  function heightAt(column: number, row: number, base: Node<"vec2">) {
    const cell = ivec2(clamp(base.add(vec2(column, row)), vec2(0, 0), vec2(lastCell, lastCell)));

    return textureLoad(textures.height, cell).x;
  }

  return Fn(() => {
    const cell = clamp(origin.add(localCell), vec2(0, 0), vec2(lastCell, lastCell)).toVar();

    const height = heightAt(0, 0, cell);
    const slopeX = heightAt(-1, 0, cell).sub(heightAt(1, 0, cell));
    const slopeZ = heightAt(0, -1, cell).sub(heightAt(0, 1, cell));

    normalLocal.assign(normalize(vec3(slopeX, cellSize.mul(2), slopeZ)));

    const drop = skirt.mul(SKIRT_DROP_PER_STEP);
    const outward = vec2(edgeSide(cell.x, lastCell), edgeSide(cell.y, lastCell));
    const inset = outward.mul(select(skirt.greaterThan(0), float(EDGE_SKIRT_INSET), float(0)));

    return vec3(
      cell.x.add(0.5).mul(cellSize).sub(halfSize).sub(inset.x),
      max(height.sub(drop), min(height, plinth)),
      cell.y.add(0.5).mul(cellSize).sub(halfSize).sub(inset.y)
    );
  })();
}

function warpedMapCoordinates(grid: WorldGrid): Node<"vec2"> {
  const point = positionWorld.xz;

  const broadWarp = vec2(
    mx_fractal_noise_float(vec3(point.mul(0.011), 0), 3, 2, 0.5),
    mx_fractal_noise_float(vec3(point.mul(0.011), 9.3), 3, 2, 0.5)
  );

  const fineWarp = vec2(mx_noise_float(vec3(point.mul(0.09), 2)), mx_noise_float(vec3(point.mul(0.09), 5)));

  const warped = point.add(broadWarp.mul(grid.cellSize * 1.4)).add(fineWarp.mul(grid.cellSize * 0.35));

  return warped.add(grid.halfSize).div(grid.worldSize);
}

function underwaterDepth(textures: TerrainTextures, grid: WorldGrid): Node<"float"> {
  const last = grid.cellsPerSide - 1;

  const cell = clamp(positionWorld.xz.add(grid.halfSize).div(grid.cellSize).floor(), vec2(0, 0), vec2(last, last));

  const reach = textureLoad(textures.shore, ivec2(cell)).w;

  return Fn(() => {
    const depth = float(0).toVar();

    If(reach.lessThan(1.5), () => {
      depth.assign(max(sampleCellsNode(textures.shore, grid, positionWorld.xz).x, 0));
    });

    return depth;
  })();
}

export function createTerrainMaterial(
  textures: TerrainTextures,
  grid: WorldGrid,
  glow: FireGlow,
  plinth: number
): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial();

  material.positionNode = terrainPosition(textures, grid, plinth);

  const mapCoordinates = warpedMapCoordinates(grid);
  const broad = mx_fractal_noise_float(positionWorld.mul(0.012), 3, 2, 0.5);
  const patches = mx_noise_float(positionWorld.mul(0.07));
  const fine = mx_noise_float(positionWorld.mul(0.42));
  const steepness = float(1).sub(normalWorld.y);
  const strataFade = smoothstep(1.2, 0.4, fwidth(positionWorld.y).mul(0.32));

  const surface = texture(textures.surface, mapCoordinates);
  const albedo = texture(textures.albedo, mapCoordinates).rgb;
  const strata = sin(positionWorld.y.mul(0.32).add(broad.mul(6)).add(patches.mul(2.5)))
    .mul(strataFade.mul(0.05))
    .add(0.95);

  const depth = underwaterDepth(textures, grid);
  const snowCover = smoothstep(0.08, 0.42, surface.r);
  const mottled = albedo.mul(broad.mul(0.1).add(patches.mul(0.07)).add(fine.mul(0.035)).add(1));
  const rockColor = vec3(0.4, 0.38, 0.355)
    .mul(strata)
    .mul(fine.mul(0.1).add(patches.mul(0.05)).add(0.97));

  const rockStart = mix(float(0.24), float(0.16), snowCover);

  const rock = smoothstep(rockStart, rockStart.add(0.14), steepness.add(broad.mul(0.07)));

  const ground = mix(mottled, rockColor, rock);

  const snowy = mix(ground, vec3(0.9, 0.93, 0.97), snowCover.mul(float(1).sub(rock.mul(0.6))));
  const wetness = max(surface.g, smoothstep(0, 0.6, depth));

  const damp = snowy.mul(float(1).sub(wetness.mul(0.32)));

  const underwater = mix(damp, damp.mul(vec3(0.5, 0.68, 0.7)), smoothstep(0.1, 3, depth));

  const ash = mix(CHARCOAL, ASH, smoothstep(0.5, 0.85, patches.mul(0.35).add(fine.mul(0.15)).add(0.5)));

  const scorched = mix(underwater, ash, surface.b.mul(0.95));

  const fireLight = fireLightAt(glow, grid, positionWorld.xz);

  material.colorNode = scorched;
  material.roughnessNode = mix(float(0.95), float(0.5), wetness);
  material.metalnessNode = float(0);
  material.emissiveNode = emberGlow(surface.a, positionWorld.xz, fine.mul(0.5).add(0.5)).add(
    scorched.mul(fireLight).mul(GROUND_FIRE_LIGHT)
  );

  return material;
}
