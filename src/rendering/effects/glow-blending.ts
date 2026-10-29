import { CustomBlending, type Material, OneFactor, SrcAlphaFactor, ZeroFactor } from "three/webgpu";

export function blendAsGlow(material: Material): void {
  material.blending = CustomBlending;
  material.blendSrc = SrcAlphaFactor;
  material.blendDst = OneFactor;
  material.blendSrcAlpha = ZeroFactor;
  material.blendDstAlpha = OneFactor;
}
