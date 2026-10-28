import { z } from "zod";
import { ERAS } from "../content/eras.ts";
import type { WorldRequest } from "../generation/generation-options.ts";
import { ISLAND_SHAPES } from "../world/island-shape.ts";
import type { Simulation, SimulationSnapshot } from "./simulation.ts";

export const SAVE_VERSION = 1;

const LARGEST_CELLS_PER_SIDE = 4096;

export interface WorldSummary {
  day: number;
  eraIndex: number;
  eraName: string;
  population: number;
  seasonName: string;
  tribeCount: number;
  year: number;
}

export interface SavedWorldState {
  request: WorldRequest;
  simulation: SimulationSnapshot;
  summary: WorldSummary;
  version: number;
}

const worldRequestSchema = z.object({
  options: z.object({
    dimensions: z.object({
      cellSize: z.number().positive(),
      cellsPerSide: z.number().int().positive().max(LARGEST_CELLS_PER_SIDE),
    }),
    erosionStrength: z.number().nonnegative(),
    shape: z.enum(ISLAND_SHAPES),
  }),
  seed: z.number().int(),
});

export const worldSummarySchema = z.object({
  day: z.number(),
  eraIndex: z.number().int().nonnegative(),
  eraName: z.string(),
  population: z.number().int().nonnegative(),
  seasonName: z.string(),
  tribeCount: z.number().int().nonnegative(),
  year: z.number().int(),
});

const sparseSchema = z.object({ cells: z.instanceof(Int32Array), values: z.instanceof(Float64Array) });

const snapshotShapeSchema = z.looseObject({
  buildings: z.looseObject({ buildings: z.array(z.looseObject({ id: z.number() })), losses: z.array(z.unknown()) }),
  calendar: z.looseObject({ day: z.number(), daySeconds: z.number().positive(), daysPerSeason: z.number().positive() }),
  chronicle: z.looseObject({ entries: z.array(z.unknown()), nextId: z.number() }),
  embers: z.array(z.unknown()),
  fauna: z.looseObject({ animals: z.array(z.looseObject({ id: z.number() })), herds: z.array(z.unknown()) }),
  fire: z.object({ burning: z.instanceof(Int32Array), heated: z.instanceof(Int32Array) }),
  hazards: z.array(z.unknown()),
  identifiers: z.number().int().positive(),
  isPaused: z.boolean(),
  random: z.array(z.number()),
  rivalry: z.looseObject({ raids: z.array(z.unknown()), relations: z.instanceof(Map) }),
  rules: z.looseObject({}),
  society: z.looseObject({
    people: z.array(z.looseObject({ id: z.number(), mover: z.looseObject({ x: z.number(), z: z.number() }) })),
    tribes: z.array(z.looseObject({ id: z.number(), technologies: z.instanceof(Set) })),
  }),
  speed: z.number().positive(),
  tick: z.number().int().nonnegative(),
  vegetationGrowth: z.looseObject({}),
  waterRecomputation: z.looseObject({ settledHeights: sparseSchema }),
  weather: z.looseObject({ kind: z.string() }),
  world: z.looseObject({
    fields: z.looseObject({ snow: z.instanceof(Float32Array), wetness: z.instanceof(Float32Array) }),
    occupancy: sparseSchema,
    terrain: z.looseObject({ height: sparseSchema, waterSurface: sparseSchema }),
    vegetation: z.looseObject({ count: z.number().int().nonnegative(), x: z.instanceof(Float32Array) }),
    water: z.looseObject({ lakes: z.array(z.unknown()), rivers: z.array(z.unknown()) }),
  }),
});

const simulationSnapshotSchema = z.custom<SimulationSnapshot>(
  (value) => snapshotShapeSchema.safeParse(value).success,
  "The saved world is damaged"
);

export const savedWorldStateSchema = z.object({
  request: worldRequestSchema,
  simulation: simulationSnapshotSchema,
  summary: worldSummarySchema,
  version: z.literal(SAVE_VERSION),
});

export function summarizeWorld(simulation: Simulation): WorldSummary {
  const calendar = simulation.calendar.view();
  const tribes = simulation.society.tribes();

  const eraIndex = tribes.reduce((highest, tribe) => Math.max(highest, tribe.eraIndex), 0);
  const era = ERAS[eraIndex];

  return {
    day: calendar.day,
    eraIndex,
    eraName: era === undefined ? "" : era.name,
    population: simulation.society.population,
    seasonName: calendar.seasonName,
    tribeCount: tribes.length,
    year: calendar.year,
  };
}
