import { ANIMALS } from "../content/animals.ts";
import { Biome, biomeDefinition } from "../content/biomes.ts";
import { BUILDINGS } from "../content/buildings.ts";
import { groundDefinition } from "../content/grounds.ts";
import { plantSpeciesDefinition } from "../content/plants.ts";
import { NO_PLANT, PlantState } from "../world/vegetation-store.ts";
import type { Selection } from "./commands.ts";
import type { FaunaSystem } from "./fauna/fauna.ts";
import type { TribeSummary } from "./frame.ts";
import { describeTribe } from "./frame-packing.ts";
import type { Environment } from "./nature/environment.ts";
import type { BuildingSystem } from "./society/buildings.ts";
import { JOB_LABELS } from "./society/jobs/job.ts";
import { isChild, type Person } from "./society/person.ts";
import type { SocietySystem } from "./society/society.ts";
import type { WorldState } from "./world/world-state.ts";

export interface PersonInspection {
  activity: string;
  age: number;
  energy: number;
  health: number;
  hunger: number;
  id: number;
  isAlive: boolean;
  isChild: boolean;
  isFemale: boolean;
  kind: "person";
  name: string;
  tribeName: string;
  warmth: number;
  x: number;
  z: number;
}

export interface AnimalInspection {
  activity: string;
  health: number;
  id: number;
  isAlive: boolean;
  isYoung: boolean;
  kind: "animal";
  name: string;
  x: number;
  z: number;
}

export interface BuildingInspection {
  fuel: number;
  health: number;
  id: number;
  isBurning: boolean;
  kind: "building";
  name: string;
  progress: number;
  tribeName: string;
  x: number;
  z: number;
}

export interface PlantDescription {
  isBurnt: boolean;
  name: string;
}

export interface CellInspection {
  biomeName: string;
  fire: number;
  groundName: string;
  height: number;
  kind: "cell";
  plants: PlantDescription[];
  scorch: number;
  snow: number;
  temperature: number;
  waterDepth: number;
  wetness: number;
  x: number;
  z: number;
}

export interface TribeInspection {
  kind: "tribe";
  summary: TribeSummary;
}

export type Inspection = AnimalInspection | BuildingInspection | CellInspection | PersonInspection | TribeInspection;

interface InspectionSources {
  buildings: BuildingSystem;
  environment: Environment;
  fauna: FaunaSystem;
  society: SocietySystem;
  world: WorldState;
}

const ANIMAL_ACTIVITIES = { dead: "Dead", graze: "Grazing", run: "Running away", walk: "Wandering" } as const;

export function inspect(selection: Selection, sources: InspectionSources): Inspection | null {
  switch (selection.kind) {
    case "animal":
      return inspectAnimal(selection.id, sources);
    case "building":
      return inspectBuilding(selection.id, sources);
    case "cell":
      return inspectCell(selection.x, selection.z, sources);
    case "person":
      return inspectPerson(selection.id, sources);
    case "tribe":
      return inspectTribe(selection.id, sources);
    default:
      throw new Error(`Unknown selection ${JSON.stringify(selection)}`);
  }
}

function tribeName(sources: InspectionSources, tribeId: number): string {
  const tribe = sources.society.findTribe(tribeId);

  if (tribe === null) {
    return "No tribe";
  }

  return tribe.name;
}

function personActivity(person: Person): string {
  if (!person.isAlive) {
    return "Dead";
  }

  if (person.job === null) {
    return JOB_LABELS.idle;
  }

  return JOB_LABELS[person.job.kind];
}

function inspectPerson(id: number, sources: InspectionSources): PersonInspection | null {
  const person = sources.society.findPerson(id);

  if (person === null) {
    return null;
  }

  return {
    activity: personActivity(person),
    age: Math.floor(person.age),
    energy: person.energy,
    health: person.health,
    hunger: person.hunger,
    id: person.id,
    isAlive: person.isAlive,
    isChild: isChild(person),
    isFemale: person.isFemale,
    kind: "person",
    name: person.name,
    tribeName: tribeName(sources, person.tribeId),
    warmth: person.warmth,
    x: person.mover.x,
    z: person.mover.z,
  };
}

function inspectAnimal(id: number, sources: InspectionSources): AnimalInspection | null {
  const animal = sources.fauna.findAnimal(id);

  if (animal === null) {
    return null;
  }

  return {
    activity: ANIMAL_ACTIVITIES[animal.pose],
    health: animal.health / ANIMALS[animal.kind].health,
    id: animal.id,
    isAlive: animal.isAlive,
    isYoung: animal.youth > 0.2,
    kind: "animal",
    name: ANIMALS[animal.kind].name,
    x: animal.mover.x,
    z: animal.mover.z,
  };
}

function inspectBuilding(id: number, sources: InspectionSources): BuildingInspection | null {
  const building = sources.buildings.find(id);

  if (building === null) {
    return null;
  }

  return {
    fuel: building.fuel,
    health: building.health / BUILDINGS[building.kind].health,
    id: building.id,
    isBurning: building.burningSeconds > 0,
    kind: "building",
    name: BUILDINGS[building.kind].name,
    progress: building.progress,
    tribeName: tribeName(sources, building.tribeId),
    x: building.x,
    z: building.z,
  };
}

function plantsIn(world: WorldState, cell: number): PlantDescription[] {
  const { vegetation } = world;

  const plants: PlantDescription[] = [];

  for (let plant = vegetation.firstPlantInCell(cell); plant !== NO_PLANT; plant = vegetation.nextPlantInCell(plant)) {
    plants.push({
      isBurnt: vegetation.state[plant] === PlantState.Burnt,
      name: plantSpeciesDefinition(vegetation.species[plant]).name,
    });
  }

  return plants;
}

function inspectCell(x: number, z: number, sources: InspectionSources): CellInspection | null {
  const { world } = sources;

  const cell = world.grid.cellAt(x, z);

  if (cell < 0) {
    return null;
  }

  const isWater = world.isWater(cell);

  return {
    biomeName: biomeDefinition(isWater ? Biome.Water : world.terrain.biome[cell]).name,
    fire: world.fields.fire[cell],
    groundName: groundDefinition(world.terrain.ground[cell]).name,
    height: world.terrain.height[cell],
    kind: "cell",
    plants: plantsIn(world, cell),
    scorch: world.fields.scorch[cell],
    snow: world.fields.snow[cell],
    temperature: world.temperature(cell, sources.environment.airTemperatureOffset),
    waterDepth: world.waterDepth(cell),
    wetness: world.fields.wetness[cell],
    x,
    z,
  };
}

function inspectTribe(id: number, sources: InspectionSources): TribeInspection | null {
  const tribe = sources.society.findTribe(id);

  if (tribe === null) {
    return null;
  }

  return { kind: "tribe", summary: describeTribe(tribe, sources.society.membersOf(tribe)) };
}
