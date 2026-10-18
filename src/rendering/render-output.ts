import { bloom } from "three/addons/tsl/display/BloomNode.js";
import { dot, float, pass, screenUV, vec4 } from "three/tsl";
import { type Camera, RenderPipeline, type Scene, type WebGPURenderer } from "three/webgpu";
import type { RenderQuality } from "./render-quality.ts";

export interface RenderOutput {
  readonly dispose: () => void;
  readonly render: () => void;
}

const BLOOM_STRENGTH = 0.28;
const BLOOM_RADIUS = 0.42;
const BLOOM_THRESHOLD = 1.1;
const VIGNETTE_STRENGTH = 0.38;

function directOutput(renderer: WebGPURenderer, scene: Scene, camera: Camera): RenderOutput {
  return {
    dispose: () => undefined,
    render: () => renderer.render(scene, camera),
  };
}

function bloomOutput(renderer: WebGPURenderer, scene: Scene, camera: Camera): RenderOutput {
  const scenePass = pass(scene, camera, { storeMultisampledColorBuffer: false, storeMultisampledDepthBuffer: false });

  const sceneColor = scenePass.getTextureNode("output");

  const glow = bloom(sceneColor, BLOOM_STRENGTH, BLOOM_RADIUS, BLOOM_THRESHOLD);
  const fromCenter = screenUV.sub(0.5);

  const vignette = float(1).sub(dot(fromCenter, fromCenter).mul(VIGNETTE_STRENGTH));

  const pipeline = new RenderPipeline(renderer, vec4(sceneColor.add(glow).rgb.mul(vignette), 1));

  return {
    dispose: () => {
      pipeline.dispose();
      glow.dispose();
      scenePass.dispose();
    },
    render: () => pipeline.render(),
  };
}

export function createRenderOutput(
  renderer: WebGPURenderer,
  scene: Scene,
  camera: Camera,
  quality: RenderQuality
): RenderOutput {
  if (quality.hasBloom) {
    return bloomOutput(renderer, scene, camera);
  }

  return directOutput(renderer, scene, camera);
}
