import {
  attribute,
  clamp,
  Fn,
  float,
  floor,
  fwidth,
  ivec2,
  max,
  min,
  mix,
  mx_fractal_noise_float,
  mx_noise_float,
  normalLocal,
  positionLocal,
  positionWorld,
  select,
  sin,
  smoothstep,
  textureLoad,
  vec2,
  vec3,
} from "three/tsl";
import {
  ClampToEdgeWrapping,
  DataTexture,
  FloatType,
  Mesh,
  MeshLambertNodeMaterial,
  MeshStandardNodeMaterial,
  NearestFilter,
  type Node,
  RedFormat,
} from "three/webgpu";
import type { WorldMirror } from "../../game/world-mirror.ts";
import type { WorldGrid } from "../../world/world-grid.ts";
import { buildIslandBaseGeometry } from "./island-base-geometry.ts";
import { PATCH_CELLS, PATCH_STEPS } from "./terrain-patches.ts";
import type { TerrainTextures } from "./terrain-textures.ts";

const CLIFF_GRAIN_OCTAVES = 4;
const UNDERSIDE_GRAIN_OCTAVES = 2;

function createStepTexture(steps: Float32Array, patchesPerSide: number): DataTexture {
  const texture = new DataTexture(steps, patchesPerSide, patchesPerSide, RedFormat, FloatType);

  texture.minFilter = NearestFilter;
  texture.magFilter = NearestFilter;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.needsUpdate = true;

  return texture;
}

function renderedSurfaceHeight(
  textures: TerrainTextures,
  steps: DataTexture,
  grid: WorldGrid,
  point: Node<"vec2">
): Node<"float"> {
  const last = grid.cellsPerSide - 1;
  const lastPatch = Math.ceil(grid.cellsPerSide / PATCH_CELLS) - 1;

  const cell = clamp(point.add(grid.halfSize).div(grid.cellSize).sub(0.5), vec2(0, 0), vec2(last, last));
  const patch = clamp(floor(cell.div(PATCH_CELLS)), vec2(0, 0), vec2(lastPatch, lastPatch));
  const step = textureLoad(steps, ivec2(patch)).x;

  const origin = patch.mul(PATCH_CELLS);
  const start = origin.add(floor(cell.sub(origin).div(step)).mul(step));
  const end = min(start.add(step), vec2(last, last));
  const along = cell.sub(start).div(max(end.sub(start), vec2(1, 1)));

  function heightAt(column: Node<"float">, row: Node<"float">): Node<"float"> {
    return textureLoad(textures.height, ivec2(vec2(column, row))).x;
  }

  const first = heightAt(start.x, start.y);
  const right = heightAt(end.x, start.y);
  const below = heightAt(start.x, end.y);
  const diagonal = heightAt(end.x, end.y);

  const nearTriangle = first.add(right.sub(first).mul(along.x)).add(below.sub(first).mul(along.y));
  const farTriangle = diagonal
    .add(below.sub(diagonal).mul(float(1).sub(along.x)))
    .add(right.sub(diagonal).mul(float(1).sub(along.y)));

  return select(along.x.add(along.y).lessThanEqual(1), nearTriangle, farTriangle);
}

function rockColor(plinth: number, grainOctaves: number): Node<"vec3"> {
  const grain = mx_fractal_noise_float(positionWorld.mul(0.018), grainOctaves, 2, 0.5);
  const streaks = mx_noise_float(
    vec3(positionWorld.x.mul(0.05), positionWorld.y.mul(0.004), positionWorld.z.mul(0.05))
  );
  const belowPlinth = float(plinth).sub(positionWorld.y);
  const strataFade = smoothstep(1.2, 0.4, fwidth(positionWorld.y).mul(0.11));

  const strata = sin(positionWorld.y.mul(0.11).add(grain.mul(4)))
    .mul(strataFade.mul(0.5))
    .add(0.5);

  const rock = mix(vec3(0.3, 0.28, 0.27), vec3(0.47, 0.4, 0.33), strata.mul(0.65).add(grain.mul(0.3)));
  const soil = vec3(0.32, 0.24, 0.17).mul(grain.mul(0.2).add(0.9));

  const soilBand = smoothstep(90, 0, belowPlinth).mul(smoothstep(-40, 10, belowPlinth));
  const moss = smoothstep(0.25, 0.7, grain.add(streaks.mul(0.4))).mul(smoothstep(260, 40, belowPlinth));
  const depthShade = smoothstep(1700, 0, belowPlinth).mul(0.5).add(0.5);

  const layered = mix(mix(rock, soil, soilBand.mul(0.8)), vec3(0.26, 0.34, 0.17), moss.mul(0.55));

  return layered.mul(depthShade).mul(streaks.mul(0.08).add(0.96));
}

function createCliffMaterial(
  textures: TerrainTextures,
  steps: DataTexture,
  grid: WorldGrid,
  plinth: number
): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial();
  const topPoint = attribute("topPoint", "vec2");
  const cliffAmount = attribute("cliffAmount", "float");
  const outward = attribute("outward", "vec2");

  material.positionNode = Fn(() => {
    const surface = renderedSurfaceHeight(textures, steps, grid, topPoint);

    normalLocal.assign(vec3(outward.x, 0, outward.y));

    return vec3(positionLocal.x, mix(positionLocal.y, surface, cliffAmount), positionLocal.z);
  })();

  material.colorNode = rockColor(plinth, CLIFF_GRAIN_OCTAVES);
  material.roughnessNode = float(0.97);
  material.metalnessNode = float(0);

  return material;
}

function createUndersideMaterial(plinth: number): MeshLambertNodeMaterial {
  const material = new MeshLambertNodeMaterial();

  material.colorNode = rockColor(plinth, UNDERSIDE_GRAIN_OCTAVES);

  return material;
}

export class IslandBase {
  readonly mesh: Mesh;
  readonly #stepData: Float32Array;
  readonly #steps: DataTexture;
  readonly #underside: Mesh;

  constructor(mirror: WorldMirror, textures: TerrainTextures) {
    const patchesPerSide = Math.ceil(mirror.grid.cellsPerSide / PATCH_CELLS);
    const geometry = buildIslandBaseGeometry(mirror, textures.outline);

    this.#stepData = new Float32Array(patchesPerSide * patchesPerSide).fill(1);
    this.#steps = createStepTexture(this.#stepData, patchesPerSide);

    this.mesh = new Mesh(geometry.cliff, createCliffMaterial(textures, this.#steps, mirror.grid, geometry.plinth));
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;

    this.#underside = new Mesh(geometry.underside, createUndersideMaterial(geometry.plinth));
    this.#underside.frustumCulled = false;
    this.mesh.add(this.#underside);
  }

  followPatchLevels(levels: Readonly<Int8Array>): void {
    let hasChanged = false;

    for (const [patch, level] of levels.entries()) {
      const step = level < 0 ? 1 : PATCH_STEPS[level];

      if (this.#stepData[patch] !== step) {
        this.#stepData[patch] = step;
        hasChanged = true;
      }
    }

    if (hasChanged) {
      this.#steps.needsUpdate = true;
    }
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.#underside.geometry.dispose();
    this.#steps.dispose();
  }
}
