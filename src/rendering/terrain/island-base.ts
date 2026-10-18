import {
  attribute,
  clamp,
  Fn,
  float,
  fwidth,
  ivec2,
  mix,
  mx_fractal_noise_float,
  mx_noise_float,
  positionLocal,
  positionWorld,
  sin,
  smoothstep,
  textureLoad,
  vec2,
  vec3,
} from "three/tsl";
import { Mesh, MeshStandardNodeMaterial } from "three/webgpu";
import type { WorldMirror } from "../../game/world-mirror.ts";
import { buildIslandBaseGeometry, islandPlinthHeight } from "./island-base-geometry.ts";
import type { TerrainTextures } from "./terrain-textures.ts";

function createBaseMaterial(textures: TerrainTextures, size: number, plinth: number): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial();
  const topCell = attribute("topCell", "vec2");
  const cliffAmount = attribute("cliffAmount", "float");
  const last = size - 1;

  material.positionNode = Fn(() => {
    const cell = ivec2(clamp(topCell, vec2(0, 0), vec2(last, last)));

    const surface = textureLoad(textures.height, cell).x;

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

  constructor(mirror: WorldMirror, textures: TerrainTextures) {
    const material = createBaseMaterial(textures, mirror.grid.cellsPerSide, islandPlinthHeight(mirror));

    this.mesh = new Mesh(buildIslandBaseGeometry(mirror), material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
  }
}
