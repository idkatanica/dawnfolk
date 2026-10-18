import { createNoise2D, createNoise3D, type NoiseFunction2D, type NoiseFunction3D } from "simplex-noise";
import type { RandomSource } from "./random.ts";

interface FractalOptions {
  gain?: number;
  octaves: number;
}

export interface NoiseSampler {
  fractal: (x: number, z: number, options: FractalOptions) => number;
  ridged: (x: number, z: number, options: FractalOptions) => number;
}

const RIDGE_ROUNDING = 0.012;
const FRACTAL_LACUNARITY = 2.03;
const RIDGED_LACUNARITY = 2.05;

class SimplexSampler implements NoiseSampler {
  readonly #noise: NoiseFunction2D;

  constructor(noise: NoiseFunction2D) {
    this.#noise = noise;
  }

  fractal(x: number, z: number, { octaves, gain = 0.5 }: FractalOptions): number {
    let sum = 0;
    let amplitude = 0.5;
    let frequency = 1;
    let normalization = 0;

    for (let octave = 0; octave < octaves; octave += 1) {
      sum += amplitude * this.#noise(x * frequency, z * frequency);
      normalization += amplitude;
      amplitude *= gain;
      frequency *= FRACTAL_LACUNARITY;
    }

    return sum / normalization;
  }

  ridged(x: number, z: number, { octaves, gain = 0.45 }: FractalOptions): number {
    let sum = 0;
    let amplitude = 0.5;
    let frequency = 1;
    let weight = 1;
    let normalization = 0;

    for (let octave = 0; octave < octaves; octave += 1) {
      const value = this.#noise(x * frequency, z * frequency);

      let ridge = 1 - Math.sqrt(value * value + RIDGE_ROUNDING);

      ridge = ridge * ridge * weight;
      weight = Math.min(1, ridge * 1.6);
      sum += ridge * amplitude;
      normalization += amplitude;
      amplitude *= gain;
      frequency *= RIDGED_LACUNARITY;
    }

    return sum / normalization;
  }
}

export function createNoiseSampler(random: RandomSource): NoiseSampler {
  return new SimplexSampler(createNoise2D(() => random.next()));
}

export interface VolumeNoise {
  fractal: (x: number, y: number, z: number, options: FractalOptions) => number;
  sample: (x: number, y: number, z: number) => number;
}

class SimplexVolume implements VolumeNoise {
  readonly #noise: NoiseFunction3D;

  constructor(noise: NoiseFunction3D) {
    this.#noise = noise;
  }

  sample(x: number, y: number, z: number): number {
    return this.#noise(x, y, z);
  }

  fractal(x: number, y: number, z: number, { octaves, gain = 0.5 }: FractalOptions): number {
    let sum = 0;
    let amplitude = 0.5;
    let frequency = 1;
    let normalization = 0;

    for (let octave = 0; octave < octaves; octave += 1) {
      sum += amplitude * this.#noise(x * frequency, y * frequency, z * frequency);
      normalization += amplitude;
      amplitude *= gain;
      frequency *= FRACTAL_LACUNARITY;
    }

    return sum / normalization;
  }
}

export function createVolumeNoise(random: RandomSource): VolumeNoise {
  return new SimplexVolume(createNoise3D(() => random.next()));
}
