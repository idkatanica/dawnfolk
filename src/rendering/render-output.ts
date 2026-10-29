import { bloom } from "three/addons/tsl/display/BloomNode.js";
import { dot, float, pass, screenUV, vec4 } from "three/tsl";
import { type Camera, HalfFloatType, type Node, RenderPipeline, type Scene, type WebGPURenderer } from "three/webgpu";
import { createOutlineControls, OUTLINE_TARGET, outlinedColor, sceneTargets } from "./outlines.ts";
import type { RenderQuality } from "./render-quality.ts";

const BLOOM_STRENGTH = 0.28;
const BLOOM_RADIUS = 0.42;
const BLOOM_THRESHOLD = 1.1;
const VIGNETTE_STRENGTH = 0.38;

export interface RenderOutput {
  readonly dispose: () => void;
  readonly render: () => void;
  readonly setOutlinesShown: (areShown: boolean) => void;
}

interface FinishedColor {
  readonly color: Node<"vec4">;
  readonly dispose: () => void;
}

function withBloom(color: Node<"vec4">): FinishedColor {
  const glow = bloom(color, BLOOM_STRENGTH, BLOOM_RADIUS, BLOOM_THRESHOLD);
  const fromCenter = screenUV.sub(0.5);
  const vignette = float(1).sub(dot(fromCenter, fromCenter).mul(VIGNETTE_STRENGTH));

  return { color: vec4(color.add(glow).rgb.mul(vignette), 1), dispose: () => glow.dispose() };
}

function finish(color: Node<"vec4">, quality: RenderQuality): FinishedColor {
  if (quality.hasBloom) {
    return withBloom(color);
  }

  return { color, dispose: () => undefined };
}

export function createRenderOutput(
  renderer: WebGPURenderer,
  scene: Scene,
  camera: Camera,
  quality: RenderQuality
): RenderOutput {
  const scenePass = pass(scene, camera, { storeMultisampledColorBuffer: false, storeMultisampledDepthBuffer: false });

  scenePass.setMRT(sceneTargets());
  scenePass.getTexture(OUTLINE_TARGET).type = HalfFloatType;

  const outlines = createOutlineControls();
  const surfaces = scenePass.getTextureNode(OUTLINE_TARGET);
  const outlined = outlinedColor(scenePass.getTextureNode("output"), surfaces, outlines);
  const finished = finish(vec4(outlined, 1), quality);

  const pipeline = new RenderPipeline(renderer, finished.color);

  return {
    dispose: () => {
      pipeline.dispose();
      finished.dispose();
      scenePass.dispose();
    },
    render: () => {
      outlines.pixelRatio.value = renderer.getPixelRatio();
      pipeline.render();
    },
    setOutlinesShown: (areShown) => {
      outlines.strength.value = areShown ? 1 : 0;
    },
  };
}
