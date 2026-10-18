import {
  cameraPosition,
  distance,
  float,
  mix,
  mx_fractal_noise_float,
  positionWorld,
  smoothstep,
  time,
  uniform,
  vec3,
} from "three/tsl";
import { Color, Mesh, MeshBasicNodeMaterial, PlaneGeometry, Vector2, Vector3 } from "three/webgpu";

const SEA_SIZE = 60_000;
const SNAP_STEP = 500;

export class CloudSea {
  readonly drift = uniform(new Vector2());
  readonly litColor = uniform(new Color(0xff_ff_ff));
  readonly mesh: Mesh;
  readonly shadeColor = uniform(new Color(0xb8_c4_d4));
  readonly sunDirection = uniform(new Vector3(0, 1, 0));

  constructor(altitude: number) {
    const geometry = new PlaneGeometry(SEA_SIZE, SEA_SIZE, 1, 1);

    geometry.rotateX(-Math.PI / 2);

    const material = new MeshBasicNodeMaterial({ depthWrite: false, transparent: true });
    const coordinates = positionWorld.xz.mul(0.000_45).add(this.drift);
    const distanceFade = smoothstep(
      float(SEA_SIZE * 0.48),
      float(SEA_SIZE * 0.3),
      distance(positionWorld, cameraPosition)
    );

    const density = mx_fractal_noise_float(vec3(coordinates, time.mul(0.003)), 5, 2.05, 0.52)
      .mul(0.5)
      .add(0.5);
    const towardSun = coordinates.add(this.sunDirection.xz.mul(0.035));

    const sunwardDensity = mx_fractal_noise_float(vec3(towardSun, time.mul(0.003)), 3, 2.05, 0.52)
      .mul(0.5)
      .add(0.5);

    const coverage = smoothstep(0.38, 0.62, density);
    const lighting = smoothstep(-0.12, 0.12, density.sub(sunwardDensity)).mul(0.6).add(0.4);

    material.colorNode = mix(this.shadeColor, this.litColor, lighting);
    material.opacityNode = coverage.mul(0.55).add(0.4).mul(distanceFade);

    this.mesh = new Mesh(geometry, material);
    this.mesh.position.y = altitude;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -5;
  }

  update(focus: Vector3): void {
    this.mesh.position.x = Math.round(focus.x / SNAP_STEP) * SNAP_STEP;
    this.mesh.position.z = Math.round(focus.z / SNAP_STEP) * SNAP_STEP;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
  }
}
