import { z } from "zod";
import { TOUCH_QUERY } from "../design/use-media-query.ts";
import { LONGEST_WORLD_NAME, worldNameFor } from "../features/new-world/world-names.ts";
import type { CameraState } from "../rendering/camera/god-camera.ts";
import { QUALITY_LEVELS, type QualityLevel } from "../rendering/render-quality.ts";
import { ISLAND_SHAPES, type IslandShapeKind } from "../world/island-shape.ts";
import { storedQuality } from "./preferences.ts";

export interface LaunchOptions {
  readonly camera: Partial<CameraState>;
  readonly hours: number | null;
  readonly isPaused: boolean;
  readonly name: string;
  readonly quality: QualityLevel;
  readonly seed: number;
  readonly shape: IslandShapeKind;
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
  name: z.string().trim().min(1).max(LONGEST_WORLD_NAME).optional(),
  paused: z.enum(["0", "1"]).optional(),
  quality: z.enum(QUALITY_LEVELS).optional(),
  seed: z.coerce.number().int().min(1).max(LARGEST_SEED).optional(),
  shape: z.enum(ISLAND_SHAPES).optional(),
});

export function randomSeed(): number {
  return 1 + Math.floor(Math.random() * LARGEST_SEED);
}

function defaultQuality(): QualityLevel {
  const stored = storedQuality();

  if (stored !== null) {
    return stored;
  }

  const isTouchDevice = window.matchMedia(TOUCH_QUERY).matches;

  return isTouchDevice ? "low" : "medium";
}

type LaunchParameters = z.output<typeof launchSchema>;

interface ParameterIssue {
  readonly path: readonly PropertyKey[];
}

function toLaunchOptions(parameters: LaunchParameters): LaunchOptions {
  const {
    camera = {},
    hours = null,
    paused = "0",
    quality = defaultQuality(),
    seed = randomSeed(),
    shape = "round",
  } = parameters;

  const { name = worldNameFor(seed) } = parameters;

  return { camera, hours, isPaused: paused === "1", name, quality, seed, shape };
}

function withoutInvalid(parameters: Record<string, string>, issues: readonly ParameterIssue[]): Record<string, string> {
  const invalidNames = new Set(issues.map((issue) => String(issue.path[0])));

  return Object.fromEntries(Object.entries(parameters).filter(([name]) => !invalidNames.has(name)));
}

export function choosesWorld(search: string): boolean {
  return new URLSearchParams(search).has("seed");
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
