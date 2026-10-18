import { z } from "zod";
import { isPowerId, type PowerId } from "../content/powers.ts";
import { WEATHER_KINDS } from "../content/weather.ts";
import { MAXIMUM_DAY_SECONDS, MINIMUM_DAY_SECONDS } from "./nature/calendar.ts";

const MAXIMUM_SPEED = 16;

const coordinate = z.number();

const powerIdSchema = z.custom<PowerId>((value) => typeof value === "string" && isPowerId(value), {
  message: "Unknown power",
});

const parametersSchema = z.record(z.string(), z.unknown());

function entitySelection(kind: "animal" | "building" | "person" | "tribe") {
  return z.object({ id: z.number().int(), kind: z.literal(kind) });
}

const selectionSchema = z.discriminatedUnion("kind", [
  entitySelection("animal"),
  entitySelection("building"),
  entitySelection("person"),
  entitySelection("tribe"),
  z.object({ kind: z.literal("cell"), x: coordinate, z: coordinate }),
]);

export type Selection = z.output<typeof selectionSchema>;

const commandSchema = z.discriminatedUnion("type", [
  z.object({
    parameters: parametersSchema,
    powerId: powerIdSchema,
    type: z.literal("usePower"),
    x: coordinate,
    z: coordinate,
  }),
  z.object({
    parameters: parametersSchema,
    powerId: powerIdSchema,
    type: z.literal("beginStroke"),
    x: coordinate,
    z: coordinate,
  }),
  z.object({ type: z.literal("moveStroke"), x: coordinate, z: coordinate }),
  z.object({ type: z.literal("endStroke") }),
  z.object({ speed: z.number().min(0).max(MAXIMUM_SPEED), type: z.literal("setSpeed") }),
  z.object({ isPaused: z.boolean(), type: z.literal("setPaused") }),
  z.object({ type: z.literal("setWeather"), weather: z.enum([...WEATHER_KINDS, "automatic"]) }),
  z.object({ direction: z.number(), speed: z.number().min(0).max(90), type: z.literal("setWind") }),
  z.object({ offset: z.number().min(-30).max(30), type: z.literal("setTemperatureOffset") }),
  z.object({ hours: z.number().min(0).max(24), type: z.literal("setHours") }),
  z.object({ season: z.number().min(0).max(4), type: z.literal("setSeason") }),
  z.object({ seconds: z.number().min(MINIMUM_DAY_SECONDS).max(MAXIMUM_DAY_SECONDS), type: z.literal("setDaySeconds") }),
  z.object({ days: z.number().int().min(1).max(30), type: z.literal("setDaysPerSeason") }),
  z.object({ isFrozen: z.boolean(), type: z.literal("setTimeFrozen") }),
  z.object({ rules: z.unknown(), type: z.literal("setWorldRules") }),
  z.object({ type: z.literal("setViewFocus"), x: coordinate, z: coordinate }),
  z.object({ selection: selectionSchema.nullable(), type: z.literal("setSelection") }),
]);

export type SimulationCommand = z.output<typeof commandSchema>;

export type SimulationCommandType = SimulationCommand["type"];

export type CommandOf<Type extends SimulationCommandType> = Extract<SimulationCommand, { type: Type }>;

export function readCommand(value: unknown): SimulationCommand | null {
  const result = commandSchema.safeParse(value);

  if (!result.success) {
    console.warn("Ignoring an invalid simulation command", result.error.issues);

    return null;
  }

  return result.data;
}
