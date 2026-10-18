import {
  attribute,
  clamp,
  dot,
  equal,
  Fn,
  float,
  floor,
  fract,
  hash,
  If,
  int,
  ivec2,
  mix,
  mx_noise_float,
  mx_noise_vec3,
  normalize,
  normalLocal,
  normalView,
  normalWorld,
  positionLocal,
  positionWorld,
  select,
  sin,
  smoothstep,
  textureLoad,
  time,
  uniform,
  varying,
  vec2,
  vec3,
} from "three/tsl";
import { Color, MeshStandardNodeMaterial, type Node, Vector2 } from "three/webgpu";
import { MaterialSlot } from "../../models/materials.ts";
import { BERRY_PART } from "../../models/plants/plant-models.ts";
import { PlantState } from "../../world/vegetation-store.ts";
import type { WorldGrid } from "../../world/world-grid.ts";
import { type FireGlow, fireLightAt } from "../effects/fire-glow.ts";
import { rotateAroundUp, slotColorTable } from "../node-helpers.ts";
import type { TerrainTextures } from "../terrain/terrain-textures.ts";

const CALM_GUST = 0.12;
const STRONGEST_GUST = 2;
const METERS_PER_SECOND_PER_GUST = 7;
const SLOWEST_GUST_FRONT = 1.5;
const GUST_FRONT_SPEEDUP = 2;

export class PlantWeather {
  readonly gust = uniform(0.5);
  readonly gustTravel = uniform(0);
  readonly wind = uniform(new Vector2(1, 0));

  blow(directionX: number, directionZ: number, metersPerSecond: number, realSeconds: number): void {
    const frontSpeed = Math.max(metersPerSecond, SLOWEST_GUST_FRONT) * GUST_FRONT_SPEEDUP;

    this.gust.value = Math.min(STRONGEST_GUST, Math.max(CALM_GUST, metersPerSecond / METERS_PER_SECOND_PER_GUST));
    this.gustTravel.value += frontSpeed * realSeconds;
    this.wind.value.set(directionX, directionZ);
  }
}

export function gustAt(weather: PlantWeather, point: Node<"vec2">): Node<"float"> {
  const front = dot(point, weather.wind).sub(weather.gustTravel);
  const across = dot(point, vec2(weather.wind.y.negate(), weather.wind.x));

  const rolling = sin(front.mul(0.045).add(sin(across.mul(0.013)).mul(2.2)))
    .mul(0.5)
    .add(0.5);
  const ripple = sin(front.mul(0.19).add(across.mul(0.05)))
    .mul(0.5)
    .add(0.5);

  return rolling.mul(0.7).add(ripple.mul(0.3));
}

export class SpeciesLook {
  readonly foliageColor = uniform(new Color(0x4e_8c_32));
  readonly foliageCoverage = uniform(1);
}

const CHARCOAL = vec3(0.035, 0.03, 0.028);
const SNOW = vec3(0.86, 0.9, 0.95);
const LEAF_PATTERN_SCALE = 1.9;
const LEAF_PATTERN_STRENGTH = 0.16;
const LEAF_BUMP_SCALE = 2.6;
const LEAF_BUMP_STRENGTH = 0.55;
const CROWN_FIRE_LIGHT = 0.45;
const SMOULDER_COLOR = vec3(1, 0.33, 0.06);
const SMOULDER_STRENGTH = 2.4;
const SMOULDER_HEIGHT = 5;
const SMOULDER_HEAT = 0.02;
const SMOULDER_CRACK_SCALE = 3.4;

interface PlantMaterialOptions {
  readonly glow: FireGlow;
  readonly grid: WorldGrid;
  readonly look: SpeciesLook;
  readonly textures: TerrainTextures;
  readonly weather: PlantWeather;
}

function isSlot(slot: Node<"float">, value: number): Node<"bool"> {
  return equal(int(slot.add(0.5)), int(value));
}

export function createPlantMaterial({
  glow,
  grid,
  look,
  textures,
  weather,
}: PlantMaterialOptions): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial();
  const placement = attribute("plantPlacement", "vec4");
  const appearance = attribute("plantLook", "vec4");
  const slot = attribute("slot", "float");
  const sway = attribute("sway", "float");
  const flutter = attribute("flutter", "float");
  const shade = attribute("shade", "float");
  const part = attribute("part", "float");
  const berryChance = hash(floor(positionLocal.mul(9)).dot(vec3(1, 57, 113)));

  const scale = appearance.x;
  const tint = appearance.y;
  const isBurnt = equal(int(appearance.z.add(0.5)), int(PlantState.Burnt));
  const fruit = appearance.w;

  const isFoliage = isSlot(slot, MaterialSlot.Leaf).or(isSlot(slot, MaterialSlot.Needle));
  const isBlossom = isSlot(slot, MaterialSlot.Blossom);
  const isBerry = equal(int(part.add(0.5)), int(BERRY_PART));
  const treeThreshold = fract(tint.mul(13.7)).mul(0.9).add(0.05);

  const hasFoliage = look.foliageCoverage.greaterThan(treeThreshold).and(isBurnt.not());
  const hasBerry = fruit.greaterThan(berryChance).and(hasFoliage);

  const keep = select(isFoliage, hasFoliage, select(isBerry, hasBerry, isBlossom.not().or(isBurnt.not())));

  const local = positionLocal.mul(scale).mul(select(keep, float(1), float(0)));

  const phase = placement.x.mul(0.047).add(placement.z.mul(0.031));
  const swaySquared = sway.mul(sway);

  const gusting = gustAt(weather, placement.xz)
    .mul(0.5)
    .add(0.35)
    .add(sin(time.mul(1.6).add(phase)).mul(0.12));

  const bend = swaySquared.mul(scale.mul(0.55).add(0.25)).mul(gusting.mul(weather.gust));
  const shiver = sin(time.mul(9).add(positionLocal.x.mul(3)).add(phase.mul(7)))
    .mul(flutter)
    .mul(0.04)
    .mul(weather.gust.add(0.2));

  const windOffset = vec3(weather.wind.x, 0, weather.wind.y)
    .mul(bend)
    .add(vec3(shiver, shiver.mul(0.5), shiver.negate()));

  material.positionNode = Fn(() => {
    normalLocal.assign(rotateAroundUp(normalLocal, placement.w));

    return rotateAroundUp(local, placement.w).add(windOffset).add(placement.xyz);
  })();

  const last = grid.cellsPerSide - 1;

  const cell = clamp(placement.xz.add(grid.halfSize).div(grid.cellSize).floor(), vec2(0, 0), vec2(last, last));

  const surface = textureLoad(textures.surface, ivec2(cell));

  const snow = varying(smoothstep(0.1, 0.45, surface.r), "plantSnow");
  const heat = varying(surface.a, "plantHeat");
  const charred = varying(select(isBurnt, float(1), select(isFoliage, float(0), float(0.6))), "plantCharred");

  const slotColors = slotColorTable();

  const variation = tint.mul(0.3).add(0.85);
  const baseColor = select(isFoliage, look.foliageColor.rgb, slotColors.element(int(slot.add(0.5))));

  const shaded = baseColor.mul(shade).mul(variation);

  const vertexColor = varying(mix(shaded, CHARCOAL, select(isBurnt, float(0.92), float(0))), "plantColor");
  const foliageMask = varying(select(isFoliage.and(isBurnt.not()), float(1), float(0)), "plantFoliage");
  const snowOnTop = snow.mul(smoothstep(0.25, 0.75, normalWorld.y));

  const leafPattern = mx_noise_float(positionWorld.mul(LEAF_PATTERN_SCALE))
    .mul(foliageMask.mul(LEAF_PATTERN_STRENGTH))
    .add(1);
  const leafBump = mx_noise_vec3(positionWorld.mul(LEAF_BUMP_SCALE)).mul(foliageMask.mul(LEAF_BUMP_STRENGTH));

  const fireLight = varying(fireLightAt(glow, grid, placement.xz), "plantFireLight");

  material.colorNode = mix(vertexColor.mul(leafPattern), SNOW, snowOnTop);

  const nearRoots = varying(smoothstep(SMOULDER_HEIGHT, 0, positionLocal.y.mul(scale)), "plantNearRoots");

  const smoulder = Fn(() => {
    const embers = vec3(0).toVar();

    If(heat.greaterThan(SMOULDER_HEAT).and(charred.mul(nearRoots).greaterThan(0)), () => {
      const cracks = smoothstep(0.35, 0.75, mx_noise_float(positionWorld.mul(SMOULDER_CRACK_SCALE)).mul(0.5).add(0.5));
      const breathing = sin(time.mul(1.7).add(placement.x.mul(0.37)).add(positionWorld.y.mul(2.1)))
        .mul(0.3)
        .add(0.7);

      embers.assign(
        SMOULDER_COLOR.mul(
          cracks
            .mul(breathing)
            .mul(charred)
            .mul(nearRoots)
            .mul(smoothstep(SMOULDER_HEAT, 0.5, heat))
        ).mul(SMOULDER_STRENGTH)
      );
    });

    return embers;
  })();

  material.emissiveNode = vertexColor.mul(fireLight).mul(CROWN_FIRE_LIGHT).add(smoulder);
  material.normalNode = normalize(normalView.add(leafBump));
  material.roughnessNode = float(0.88);
  material.metalnessNode = float(0);

  return material;
}
