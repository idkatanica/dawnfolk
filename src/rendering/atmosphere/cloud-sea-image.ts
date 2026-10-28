import type { Color } from "../../content/grounds.ts";
import { lerp, smoothstep } from "../../shared/math.ts";
import { createNoiseSampler } from "../../shared/noise.ts";
import { createRandom } from "../../shared/random.ts";

const BYTE = 255;
const SPAN = 2;
const SKY: Color = [0.78, 0.82, 0.87];
const LIT: Color = [1, 1, 1];
const SHADE: Color = [0.72, 0.77, 0.83];
const SUN_OFFSET = 0.035;

export function paintCloudSea(width: number, height: number, seed: number): ImageData {
  const image = new ImageData(width, height);
  const noise = createNoiseSampler(createRandom(seed));

  const scale = SPAN / Math.max(width, height);

  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const x = column * scale;
      const z = row * scale;

      const density = noise.fractal(x, z, { gain: 0.52, octaves: 5 }) * 0.5 + 0.5;
      const sunward = noise.fractal(x + SUN_OFFSET, z - SUN_OFFSET, { gain: 0.52, octaves: 3 }) * 0.5 + 0.5;

      const coverage = smoothstep(0.38, 0.62, density);
      const lighting = smoothstep(-0.12, 0.12, density - sunward) * 0.6 + 0.4;
      const opacity = coverage * 0.55 + 0.4;

      const offset = (row * width + column) * 4;

      for (let channel = 0; channel < 3; channel += 1) {
        const cloud = lerp(SHADE[channel], LIT[channel], lighting);

        image.data[offset + channel] = lerp(SKY[channel], cloud, opacity) * BYTE;
      }

      image.data[offset + 3] = BYTE;
    }
  }

  return image;
}
