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
  smoothstep,
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
  type PixelFormat,
  QuadMesh,
  RenderTarget,
  RGBAFormat,
  RGFormat,
  SRGBColorSpace,
  type Texture,
  type TextureDataType,
  UnsignedByteType,
  Vector3,
  Vector4,
  type WebGPURenderer,
} from "three/webgpu";
import { CROP_KINDS, type CropKind, FENCED_CROP_OFFSET } from "../../content/crops.ts";
import { GROUNDS, Ground, seasonalGroundColor } from "../../content/grounds.ts";
import type { WorldMirror } from "../../game/world-mirror.ts";
import { lerp, saturate } from "../../shared/math.ts";

const BYTE = 255;
const FIELD_COVERAGE = 0.75;

type Tint = readonly [number, number, number];

const GROWING_TINTS: Readonly<Record<CropKind, Tint>> = {
  barley: [0.4, 0.55, 0.25],
  beans: [0.3, 0.48, 0.2],
  carrots: [0.32, 0.52, 0.22],
  flax: [0.42, 0.52, 0.62],
  turnips: [0.34, 0.54, 0.26],
  wheat: [0.36, 0.52, 0.22],
};

const RIPE_TINTS: Readonly<Record<CropKind, Tint>> = {
  barley: [0.8, 0.7, 0.42],
  beans: [0.5, 0.52, 0.27],
  carrots: [0.32, 0.52, 0.22],
  flax: [0.58, 0.5, 0.32],
  turnips: [0.34, 0.54, 0.26],
  wheat: [0.78, 0.64, 0.3],
};

function tintTable(tints: Readonly<Record<CropKind, Tint>>) {
  return uniformArray<"vec3">(
    CROP_KINDS.map((kind) => new Vector3(...tints[kind])),
    "vec3"
  );
}

function cellTexture(
  data: Float32Array | Uint8Array,
  size: number,
  type: TextureDataType,
  format: PixelFormat
): DataTexture {
  const texture = new DataTexture(data, size, size, format, type);

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

function fieldColor(soil: Node<"vec3">, code: Node<"int">, growth: Node<"float">): Node<"vec3"> {
  const growing = tintTable(GROWING_TINTS);
  const ripe = tintTable(RIPE_TINTS);

  const kind = select(code.greaterThanEqual(int(FENCED_CROP_OFFSET)), code.sub(FENCED_CROP_OFFSET), code).sub(1);
  const isBare = kind.lessThan(int(0));
  const index = select(isBare, int(0), kind);

  const crop = mix(growing.element(index), ripe.element(index), smoothstep(0.78, 1, growth));
  const coverage = select(isBare, float(0), smoothstep(0.08, 0.7, growth).mul(FIELD_COVERAGE));

  return mix(soil, crop, coverage);
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

    this.#ground = cellTexture(mirror.ground, size, UnsignedByteType, RGBAFormat);
    this.#lushness = cellTexture(lushnessData(mirror), size, FloatType, RGFormat);
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
      const [red, green, blue] = seasonalGroundColor(index, season);

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
    const trodden = ground.b;
    const cropCode = int(ground.a.mul(BYTE).add(0.5));

    const isFarm = groundIndex.equal(int(Ground.Farm));
    const seasonal = palette.element(groundIndex);
    const earth = palette.element(int(Ground.Dirt));

    const base = select(isFarm, fieldColor(seasonal.rgb, cropCode, growth), seasonal.rgb);
    const worn = mix(base, earth.rgb, trodden);
    const cover = select(isFarm, float(0), seasonal.a).mul(float(1).sub(trodden));
    const color = clamp(worn.mul(vec3(lushness.r, lushness.g, lushness.r)), 0, 1);

    const levels = floor(vec4(color, cover).mul(BYTE).add(0.5)).div(BYTE);

    return vec4(linearFromSrgb(levels.rgb), levels.a);
  }
}
