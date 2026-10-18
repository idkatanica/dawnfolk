import { ACESFilmicToneMapping, PCFShadowMap, WebGPURenderer } from "three/webgpu";
import type { RenderQuality } from "./render-quality.ts";

export type GraphicsBackend = "webgl" | "webgpu";

export interface CreatedRenderer {
  readonly backend: GraphicsBackend;
  readonly renderer: WebGPURenderer;
}

export async function createRenderer(canvas: HTMLCanvasElement, quality: RenderQuality): Promise<CreatedRenderer> {
  const renderer = new WebGPURenderer({
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

  return { backend: backendOf(renderer), renderer };
}

function backendOf(renderer: WebGPURenderer): GraphicsBackend {
  if ("isWebGPUBackend" in renderer.backend) {
    return "webgpu";
  }

  return "webgl";
}
