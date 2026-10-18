import {
  abs,
  attribute,
  clamp,
  Fn,
  float,
  floor,
  fwidth,
  If,
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
  MeshStandardNodeMaterial,
  NearestFilter,
  type Node,
  RedFormat,
} from "three/webgpu";
import type { WorldMirror } from "../../game/world-mirror.ts";
import { buildIslandBaseGeometry, islandPlinthHeight } from "./island-base-geometry.ts";
import { PATCH_CELLS, PATCH_STEPS } from "./terrain-patches.ts";
import type { TerrainTextures } from "./terrain-textures.ts";

function createStepTexture(steps: Float32Array, patchesPerSide: number): DataTexture {
  const texture = new DataTexture(steps, patchesPerSide, patchesPerSide, RedFormat, FloatType);

  texture.minFilter = NearestFilter;
  texture.magFilter = NearestFilter;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.needsUpdate = true;

  return texture;
}

function renderedEdgeHeight(textures: TerrainTextures, steps: DataTexture, size: number): Node<"float"> {
  const topCell = attribute("topCell", "vec2");
  const outward = attribute("outward", "vec2");
  const last = size - 1;
  const lastPatch = Math.ceil(size / PATCH_CELLS) - 1;

  const isAlongColumns = abs(outward.y).greaterThan(0.5);
  const patch = ivec2(clamp(floor(topCell.div(PATCH_CELLS)), vec2(0, 0), vec2(lastPatch, lastPatch)));

  const along = select(isAlongColumns, topCell.x, topCell.y);
  const step = textureLoad(steps, patch).x;

  const start = floor(along.div(step)).mul(step);

  const end = min(start.add(step), last);

  function heightAt(position: Node<"float">) {
    const cell = select(isAlongColumns, vec2(position, topCell.y), vec2(topCell.x, position));

    return textureLoad(textures.height, ivec2(clamp(cell, vec2(0, 0), vec2(last, last)))).x;
  }

  return mix(heightAt(start), heightAt(end), along.sub(start).div(max(end.sub(start), 1)));
}

function createBaseMaterial(
  textures: TerrainTextures,
  steps: DataTexture,
  size: number,
  plinth: number
): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial();
  const cliffAmount = attribute("cliffAmount", "float");
  const outward = attribute("outward", "vec2");

  material.positionNode = Fn(() => {
    const surface = renderedEdgeHeight(textures, steps, size);

    If(cliffAmount.greaterThan(0), () => {
      normalLocal.assign(vec3(outward.x, 0, outward.y));
    });

    return vec3(positionLocal.x, mix(positionLocal.y, surface, cliffAmount), positionLocal.z);
  })();

  const grain = mx_fractal_noise_float(positionWorld.mul(0.018), 4, 2, 0.5);
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

  material.colorNode = layered.mul(depthShade).mul(streaks.mul(0.08).add(0.96));
  material.roughnessNode = float(0.97);
  material.metalnessNode = float(0);

  return material;
}

export class IslandBase {
  readonly mesh: Mesh;
  readonly #stepData: Float32Array;
  readonly #steps: DataTexture;

  constructor(mirror: WorldMirror, textures: TerrainTextures) {
    const size = mirror.grid.cellsPerSide;
    const patchesPerSide = Math.ceil(size / PATCH_CELLS);

    this.#stepData = new Float32Array(patchesPerSide * patchesPerSide).fill(1);
    this.#steps = createStepTexture(this.#stepData, patchesPerSide);

    const material = createBaseMaterial(textures, this.#steps, size, islandPlinthHeight(mirror));

    this.mesh = new Mesh(buildIslandBaseGeometry(mirror), material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
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
    this.#steps.dispose();
  }
}
