import { z } from "zod";
import { isPowerId, type PowerId } from "../content/powers.ts";
import {
  MAXIMUM_TEMPERATURE_OFFSET,
  MAXIMUM_WIND_SPEED,
  MINIMUM_TEMPERATURE_OFFSET,
  WEATHER_KINDS,
} from "../content/weather.ts";
import {
  MAXIMUM_DAY_SECONDS,
  MAXIMUM_DAYS_PER_SEASON,
  MINIMUM_DAY_SECONDS,
  MINIMUM_DAYS_PER_SEASON,
} from "./nature/calendar.ts";
import { SIMULATION_SPEEDS } from "./tick.ts";

const MAXIMUM_SPEED = Math.max(...SIMULATION_SPEEDS);

const coordinate = z.number();

const powerIdSchema = z.custom<PowerId>(
  (value) => {
    return typeof value === "string" && isPowerId(value);
  },
  {
    message: "Unknown power",
  }
);

const parametersSchema = z.record(z.string(), z.unknown());

const powerUse = { parameters: parametersSchema, powerId: powerIdSchema, x: coordinate, z: coordinate };

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
  z.object({ ...powerUse, type: z.literal("usePower") }),
  z.object({ ...powerUse, type: z.literal("beginStroke") }),
  z.object({ type: z.literal("moveStroke"), x: coordinate, z: coordinate }),
  z.object({ type: z.literal("endStroke") }),
  z.object({ speed: z.number().min(0).max(MAXIMUM_SPEED), type: z.literal("setSpeed") }),
  z.object({ isPaused: z.boolean(), type: z.literal("setPaused") }),
  z.object({ type: z.literal("setWeather"), weather: z.enum([...WEATHER_KINDS, "automatic"]) }),
  z.object({ direction: z.number(), speed: z.number().min(0).max(MAXIMUM_WIND_SPEED), type: z.literal("setWind") }),
  z.object({
    offset: z.number().min(MINIMUM_TEMPERATURE_OFFSET).max(MAXIMUM_TEMPERATURE_OFFSET),
    type: z.literal("setTemperatureOffset"),
  }),
  z.object({ hours: z.number().min(0).max(24), type: z.literal("setHours") }),
  z.object({ season: z.number().min(0).max(4), type: z.literal("setSeason") }),
  z.object({ seconds: z.number().min(MINIMUM_DAY_SECONDS).max(MAXIMUM_DAY_SECONDS), type: z.literal("setDaySeconds") }),
  z.object({
    days: z.number().int().min(MINIMUM_DAYS_PER_SEASON).max(MAXIMUM_DAYS_PER_SEASON),
    type: z.literal("setDaysPerSeason"),
  }),
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
