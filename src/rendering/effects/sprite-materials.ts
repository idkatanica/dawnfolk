import { float, mx_noise_float, smoothstep, time, varying, vec3 } from "three/tsl";
import { MeshBasicNodeMaterial } from "three/webgpu";
import { billboardNodes, type CameraAxes, distanceFromBillboardCenter, facingBillboard } from "./billboards.ts";
import { blendAsGlow } from "./glow-blending.ts";

export function createGlowMaterial(axes: CameraAxes): MeshBasicNodeMaterial {
  const material = new MeshBasicNodeMaterial({ depthWrite: false, transparent: true });

  blendAsGlow(material);

  const { corner, look, placement } = billboardNodes();

  material.positionNode = facingBillboard(axes, placement.xyz, corner, placement.w);

  const shape = varying(corner, "glowCorner");

  const radius = distanceFromBillboardCenter(shape).mul(2);
  const halo = smoothstep(1, 0, radius);

  material.colorNode = look.xyz.mul(halo.mul(halo).mul(2.2).add(halo.mul(0.6)));
  material.opacityNode = halo.mul(look.w);
  material.fog = false;

  return material;
}

export function createDustMaterial(axes: CameraAxes): MeshBasicNodeMaterial {
  const material = new MeshBasicNodeMaterial({ depthWrite: false, transparent: true });
  const { corner, look, placement } = billboardNodes();

  material.positionNode = facingBillboard(axes, placement.xyz, corner, placement.w);

  const shape = varying(corner, "dustCorner");

  const radius = distanceFromBillboardCenter(shape).mul(2);
  const billow = mx_noise_float(vec3(shape.mul(2.6), time.mul(0.3)))
    .mul(0.3)
    .add(0.8);

  material.colorNode = look.xyz;
  material.opacityNode = smoothstep(1, float(0.2), radius).mul(billow).mul(look.w);

  return material;
}
