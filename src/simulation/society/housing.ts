import { BUILDINGS } from "../../content/buildings.ts";
import type { Building } from "./buildings.ts";
import type { SocietyContext } from "./society-context.ts";
import { BASE_HOUSING, type Tribe } from "./tribe.ts";
import { completedBuilding } from "./tribe-places.ts";

export function completedShelters(tribe: Tribe, context: SocietyContext): Building[] {
  return tribe.buildings.shelterIds
    .map((shelterId) => completedBuilding(context.buildings, shelterId))
    .filter((shelter) => shelter !== null);
}

export function housingCapacity(tribe: Tribe, context: SocietyContext): number {
  return completedShelters(tribe, context).reduce(
    (capacity, shelter) => capacity + BUILDINGS[shelter.kind].capacity,
    BASE_HOUSING
  );
}

export function assignHomes(tribe: Tribe, context: SocietyContext): void {
  const beds = completedShelters(tribe, context).flatMap((shelter) =>
    Array.from({ length: BUILDINGS[shelter.kind].capacity }, () => shelter.id)
  );

  for (const [index, person] of context.people.membersOf(tribe).entries()) {
    person.homeId = bedAt(beds, index);
  }
}

function bedAt(beds: readonly number[], index: number): number | null {
  if (index >= beds.length) {
    return null;
  }

  return beds[index];
}
