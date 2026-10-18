import { FULL_TURN } from "../../shared/math.ts";
import type { RandomSource } from "../../shared/random.ts";
import type { Waypoint } from "../agents/navigation.ts";
import { type Building, type BuildingSystem, isCampfireLit, isComplete } from "./buildings.ts";
import type { Person } from "./person.ts";
import type { Tribe } from "./tribe.ts";

const GOLDEN_ANGLE = 2.399;

function campPoint(tribe: Tribe): Waypoint {
  return { x: tribe.campX, z: tribe.campZ };
}

export function nearCamp(tribe: Tribe, spread: number, random: RandomSource): Waypoint {
  return { x: tribe.campX + random.signed() * spread, z: tribe.campZ + random.signed() * spread };
}

export function campfireOf(tribe: Tribe, buildings: BuildingSystem): Building | null {
  return buildings.find(tribe.buildings.campfireId);
}

export function hasLitCampfire(tribe: Tribe, buildings: BuildingSystem): boolean {
  return isCampfireLit(campfireOf(tribe, buildings));
}

export function litCampfireOf(tribe: Tribe, buildings: BuildingSystem): Building | null {
  const campfire = campfireOf(tribe, buildings);

  if (!isCampfireLit(campfire)) {
    return null;
  }

  return campfire;
}

export function completedBuilding(buildings: BuildingSystem, id: number | null): Building | null {
  const building = buildings.find(id);

  if (building === null || !isComplete(building)) {
    return null;
  }

  return building;
}

export function sleepingSpot(person: Person, tribe: Tribe, buildings: BuildingSystem, random: RandomSource): Waypoint {
  const home = completedBuilding(buildings, person.homeId);

  if (home !== null) {
    return { x: home.x + random.signed(), z: home.z + random.signed() };
  }

  const angle = (person.id * GOLDEN_ANGLE) % FULL_TURN;
  const distance = 5 + (person.id % 4) * 1.5;

  const center = fireOrCamp(tribe, buildings);

  return { x: center.x + Math.cos(angle) * distance, z: center.z + Math.sin(angle) * distance };
}

function fireOrCamp(tribe: Tribe, buildings: BuildingSystem): Waypoint {
  const campfire = litCampfireOf(tribe, buildings);

  if (campfire === null) {
    return campPoint(tribe);
  }

  return { x: campfire.x, z: campfire.z };
}
