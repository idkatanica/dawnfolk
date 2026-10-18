import {
  clamp,
  float,
  floor,
  int,
  ivec2,
  mix,
  pow,
  screenCoordinate,
  select,
  step,
  textureLoad,
  uniformArray,
  vec3,
  vec4,
} from "three/tsl";
import {
  DataTexture,
  FloatType,
  LinearFilter,
  NearestFilter,
  type Node,
  NodeMaterial,
  QuadMesh,
  RenderTarget,
  RGFormat,
  SRGBColorSpace,
  type Texture,
  type TextureDataType,
  UnsignedByteType,
  Vector4,
  type WebGPURenderer,
} from "three/webgpu";
import { GROUNDS, Ground, seasonalGroundColor } from "../../content/grounds.ts";
import type { WorldMirror } from "../../game/world-mirror.ts";
import { lerp, saturate } from "../../shared/math.ts";

const BYTE = 255;
const CROP_COVER = 0.9;

const FIELD_SOIL = vec3(0.4, 0.31, 0.22);
const FIELD_SPROUT = vec3(0.42, 0.55, 0.25);
const FIELD_RIPE = vec3(0.8, 0.67, 0.32);

function cellTexture(data: Float32Array | Uint8Array, size: number, type: TextureDataType): DataTexture {
  const texture = new DataTexture(data, size, size, RGFormat, type);

  texture.minFilter = NearestFilter;
  texture.magFilter = NearestFilter;
  texture.needsUpdate = true;

  return texture;
}

function lushnessData(mirror: WorldMirror): Float32Array {
  const { moisture, variation } = mirror.terrain;
  const data = new Float32Array(mirror.grid.cellCount * 2);

  for (let cell = 0; cell < mirror.grid.cellCount; cell += 1) {
    const wetness = saturate(moisture[cell]);
    const lushness = lerp(1.04, 0.9, wetness) * (1 + variation[cell] * 0.09);

    data[cell * 2] = lushness;
    data[cell * 2 + 1] = lushness + wetness * 0.04;
  }

  return data;
}

function linearFromSrgb(color: Node<"vec3">): Node<"vec3"> {
  const curve = pow(color.mul(0.947_867_298_6).add(0.052_132_701_4), vec3(2.4));

  return mix(curve, color.mul(0.077_399_380_8), step(color, vec3(0.040_45)));
}

function cropColor(growth: Node<"float">): Node<"vec3"> {
  return select(
    growth.lessThan(0.5),
    mix(FIELD_SOIL, FIELD_SPROUT, growth.div(0.5)),
    mix(FIELD_SPROUT, FIELD_RIPE, growth.sub(0.5).div(0.5))
  );
}

export class GroundAlbedo {
  readonly #ground: DataTexture;
  readonly #lushness: DataTexture;
  readonly #material = new NodeMaterial();
  readonly #palette = GROUNDS.map(() => new Vector4());
  readonly #quad = new QuadMesh(this.#material);
  readonly #target: RenderTarget;

  constructor(mirror: WorldMirror) {
    const size = mirror.grid.cellsPerSide;

    this.#ground = cellTexture(mirror.ground, size, UnsignedByteType);
    this.#lushness = cellTexture(lushnessData(mirror), size, FloatType);
    this.#target = new RenderTarget(size, size, {
      colorSpace: SRGBColorSpace,
      depthBuffer: false,
      magFilter: LinearFilter,
      minFilter: LinearFilter,
      type: UnsignedByteType,
    });
    this.#material.fragmentNode = this.#albedoNode();
  }

  get texture(): Texture {
    return this.#target.texture;
  }

  groundChanged(): void {
    this.#ground.needsUpdate = true;
  }

  paint(renderer: WebGPURenderer, season: number): void {
    const previousTarget = renderer.getRenderTarget();

    for (const [index, color] of this.#palette.entries()) {
      const [red, green, blue] = seasonalGroundColor(index, season, 0);

      color.set(red, green, blue, GROUNDS[index].grass);
    }

    renderer.setRenderTarget(this.#target);
    this.#quad.render(renderer);
    renderer.setRenderTarget(previousTarget);
  }

  dispose(): void {
    this.#target.dispose();
    this.#material.dispose();
    this.#ground.dispose();
    this.#lushness.dispose();
  }

  #albedoNode(): Node<"vec4"> {
    const cell = ivec2(screenCoordinate);
    const palette = uniformArray<"vec4">(this.#palette, "vec4");

    const ground = textureLoad(this.#ground, cell);
    const lushness = textureLoad(this.#lushness, cell);

    const groundIndex = int(ground.r.mul(BYTE).add(0.5));
    const growth = ground.g;

    const isFarm = groundIndex.equal(int(Ground.Farm));
    const seasonal = palette.element(groundIndex);

    const base = select(isFarm, cropColor(growth), seasonal.rgb);
    const cover = select(isFarm, select(growth.greaterThan(0), float(CROP_COVER), float(0)), seasonal.a);
    const color = clamp(base.mul(vec3(lushness.r, lushness.g, lushness.r)), 0, 1);

    const levels = floor(vec4(color, cover).mul(BYTE).add(0.5)).div(BYTE);

    return vec4(linearFromSrgb(levels.rgb), levels.a);
  }
}
