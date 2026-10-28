import { currentEra, nextEra } from "../../content/eras.ts";
import { RESOURCES } from "../../content/resources.ts";
import { type TechnologyDefinition, type TechnologyId, technologyDefinition } from "../../content/technologies.ts";
import type { SocietyContext } from "./society-context.ts";
import { knows, type Tribe, upcomingTechnology } from "./tribe.ts";

const STARTER_SPEARS = 3;
const STARTER_BOWS = 1;
const STARTER_ARROWS = 12;

interface TribeGoal {
  isBlocked: boolean;
  need: string | null;
  progress: number;
  technology: TechnologyDefinition;
}

export function isReadyToDiscover(tribe: Tribe, technology: TechnologyDefinition): boolean {
  if (technology.needs === null) {
    return true;
  }

  return tribe.stock[technology.needs.resource] >= technology.needs.amount;
}

export function syncEra(tribe: Tribe): void {
  tribe.eraIndex = currentEra(tribe.technologies).index;
}

function equipDiscovery(tribe: Tribe, technology: TechnologyId): void {
  if (technology === "spear") {
    tribe.stock.spears += STARTER_SPEARS;
  }

  if (technology === "archery") {
    tribe.stock.bows += STARTER_BOWS;
    tribe.stock.arrows += STARTER_ARROWS;
  }
}

export function discover(tribe: Tribe, technology: TechnologyId, message: string, context: SocietyContext): void {
  if (knows(tribe, technology)) {
    return;
  }

  tribe.technologies.add(technology);
  equipDiscovery(tribe, technology);
  context.chronicle.record({ category: "discovery", text: message, tribeId: tribe.id, x: tribe.campX, z: tribe.campZ });
  announceEra(tribe, context);
}

function announceEra(tribe: Tribe, context: SocietyContext): void {
  const era = currentEra(tribe.technologies);

  if (era.index <= tribe.eraIndex) {
    return;
  }

  tribe.eraIndex = era.index;
  context.chronicle.record({
    category: "era",
    text: `The ${tribe.name} enters the ${era.name}`,
    tribeId: tribe.id,
    x: tribe.campX,
    z: tribe.campZ,
  });
}

function needText(technology: TechnologyDefinition): string | null {
  if (technology.needs === null) {
    return null;
  }

  return `${technology.needs.amount} ${RESOURCES[technology.needs.resource].name.toLowerCase()}`;
}

export function tribeGoal(tribe: Tribe): TribeGoal | null {
  const upcoming = upcomingTechnology(tribe);

  if (upcoming === undefined) {
    return null;
  }

  return {
    isBlocked: !isReadyToDiscover(tribe, upcoming),
    need: needText(upcoming),
    progress: Math.min(1, tribe.knowledge / upcoming.cost),
    technology: upcoming,
  };
}

export function nextEraName(tribe: Tribe): string | null {
  const following = nextEra(currentEra(tribe.technologies));

  if (following === null) {
    return null;
  }

  return following.name;
}

export function technologyNames(tribe: Tribe): string[] {
  return [...tribe.technologies].map((technology) => technologyDefinition(technology).name);
}
