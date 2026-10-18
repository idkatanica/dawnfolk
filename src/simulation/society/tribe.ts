import type { TribeIdentity } from "../../content/names.ts";
import {
  currentEra,
  nextTechnology,
  type TechnologyDefinition,
  type TechnologyId,
} from "../../content/technologies.ts";
import type { WorldRules } from "../../content/world-rules.ts";

export const BASE_HOUSING = 4;

const NEVER = Number.NEGATIVE_INFINITY;

export type ScarceResource = "berries" | "fish" | "game" | "stone" | "wood";

export interface Stock {
  food: number;
  stone: number;
  wood: number;
}

export interface Field {
  cell: number;
  growth: number;
  tending: number;
}

export interface TribeBuildings {
  campfireId: number | null;
  constructionSiteId: number | null;
  shelterIds: number[];
  storehouseId: number | null;
  totemId: number | null;
}

export interface TribeTimers {
  birthDays: number;
  cropDays: number;
  dailyDays: number;
  planningSeconds: number;
}

export interface Tribe {
  births: number;
  buildings: TribeBuildings;
  campX: number;
  campZ: number;
  claimedPlants: Set<number>;
  color: string;
  deaths: number;
  faith: number;
  fields: Field[];
  foundedDay: number;
  furColor: string;
  id: number;
  isMigrating: boolean;
  knowledge: number;
  lastScarcity: Record<ScarceResource, number>;
  memberIds: number[];
  migrationStartDay: number;
  name: string;
  stock: Stock;
  technologies: Set<TechnologyId>;
  timers: TribeTimers;
}

export interface TribeFounding {
  campX: number;
  campZ: number;
  day: number;
  id: number;
  identity: TribeIdentity;
}

export function createTribe(founding: TribeFounding): Tribe {
  return {
    births: 0,
    buildings: { campfireId: null, constructionSiteId: null, shelterIds: [], storehouseId: null, totemId: null },
    campX: founding.campX,
    campZ: founding.campZ,
    claimedPlants: new Set(),
    color: founding.identity.color,
    deaths: 0,
    faith: 30,
    fields: [],
    foundedDay: founding.day,
    furColor: founding.identity.furColor,
    id: founding.id,
    isMigrating: false,
    knowledge: 0,
    lastScarcity: { berries: NEVER, fish: NEVER, game: NEVER, stone: NEVER, wood: NEVER },
    memberIds: [],
    migrationStartDay: founding.day,
    name: founding.identity.name,
    stock: { food: 10, stone: 0, wood: 4 },
    technologies: new Set(),
    timers: { birthDays: 0, cropDays: 0, dailyDays: 0, planningSeconds: 1 },
  };
}

export function knows(tribe: Tribe, technology: TechnologyId): boolean {
  return tribe.technologies.has(technology);
}

export function eraName(tribe: Tribe): string {
  return currentEra(tribe.technologies).name;
}

export function upcomingTechnology(tribe: Tribe): TechnologyDefinition | undefined {
  return nextTechnology(tribe.technologies);
}

export function markScarce(tribe: Tribe, resource: ScarceResource, day: number): void {
  tribe.lastScarcity[resource] = day;
}

export function isWorthLookingFor(tribe: Tribe, resource: ScarceResource, day: number, patienceDays: number): boolean {
  return day - tribe.lastScarcity[resource] > patienceDays;
}

export function learn(tribe: Tribe, amount: number, rules: WorldRules): void {
  tribe.knowledge += amount * rules.life.learningSpeed;
}
