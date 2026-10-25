import { ACESFilmicToneMapping, PCFShadowMap, WebGPURenderer } from "three/webgpu";
import type { RenderQuality } from "./render-quality.ts";

export async function createRenderer(canvas: HTMLCanvasElement, quality: RenderQuality): Promise<WebGPURenderer> {
  const renderer = new WebGPURenderer({
    alpha: false,
    antialias: quality.hasAntialias,
    canvas,
    powerPreference: "high-performance",
    reversedDepthBuffer: true,
  });

  await renderer.init();

  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = quality.shadowMapSize > 0;
  renderer.shadowMap.type = PCFShadowMap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality.maximumPixelRatio));

  return renderer;
}
