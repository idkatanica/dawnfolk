import { z } from "zod";
import type { CameraState } from "../rendering/camera/god-camera.ts";
import { QUALITY_LEVELS, type QualityLevel } from "../rendering/render-quality.ts";
import { storedQuality } from "./preferences.ts";

export interface LaunchOptions {
  readonly camera: Partial<CameraState>;
  readonly hours: number | null;
  readonly isPaused: boolean;
  readonly quality: QualityLevel;
  readonly seed: number;
}

export const LARGEST_SEED = 999_999;

const cameraSchema = z
  .string()
  .transform((text) => text.split(",").map(Number))
  .pipe(z.tuple([z.number(), z.number(), z.number().positive(), z.number(), z.number()]))
  .transform(([targetX, targetZ, distance, pitch, yaw]) => ({ distance, pitch, targetX, targetZ, yaw }));

const launchSchema = z.object({
  camera: cameraSchema.optional(),
  hours: z.coerce.number().min(0).max(24).optional(),
  paused: z.enum(["0", "1"]).optional(),
  quality: z.enum(QUALITY_LEVELS).optional(),
  seed: z.coerce.number().int().min(1).max(LARGEST_SEED).optional(),
});

export function randomSeed(): number {
  return 1 + Math.floor(Math.random() * LARGEST_SEED);
}

function defaultQuality(): QualityLevel {
  const stored = storedQuality();

  if (stored !== null) {
    return stored;
  }

  const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;

  return isTouchDevice ? "low" : "medium";
}

type LaunchParameters = z.output<typeof launchSchema>;

interface ParameterIssue {
  readonly path: readonly PropertyKey[];
}

function toLaunchOptions(parameters: LaunchParameters): LaunchOptions {
  const { camera = {}, hours = null, paused = "0", quality = defaultQuality(), seed = randomSeed() } = parameters;

  return { camera, hours, isPaused: paused === "1", quality, seed };
}

function withoutInvalid(parameters: Record<string, string>, issues: readonly ParameterIssue[]): Record<string, string> {
  const invalidNames = new Set(issues.map((issue) => String(issue.path[0])));

  return Object.fromEntries(Object.entries(parameters).filter(([name]) => !invalidNames.has(name)));
}

export function readLaunchOptions(search: string): LaunchOptions {
  const parameters = Object.fromEntries(new URLSearchParams(search));

  const result = launchSchema.safeParse(parameters);

  if (result.success) {
    return toLaunchOptions(result.data);
  }

  console.warn("Ignoring invalid launch parameters", result.error.issues);

  const validOnly = launchSchema.safeParse(withoutInvalid(parameters, result.error.issues));

  return toLaunchOptions(validOnly.success ? validOnly.data : {});
}
