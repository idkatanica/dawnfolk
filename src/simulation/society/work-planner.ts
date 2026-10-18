import { BUILDINGS } from "../../content/buildings.ts";
import { isWinter } from "../../content/seasons.ts";
import type { Building } from "./buildings.ts";
import { plannedBuilding } from "./construction.ts";
import { BuildJob } from "./jobs/build-job.ts";
import { findTree } from "./jobs/chop-job.ts";
import { FarmJob, isHarvestTime } from "./jobs/farm-job.ts";
import { findFishingSpot } from "./jobs/fish-job.ts";
import { findBerries } from "./jobs/gather-job.ts";
import { findGame } from "./jobs/hunt-job.ts";
import type { Job, JobKind } from "./jobs/job.ts";
import { PrayJob } from "./jobs/pray-job.ts";
import { findStone } from "./jobs/quarry-job.ts";
import { TendJob } from "./jobs/tend-job.ts";
import { isElder } from "./person.ts";
import type { PersonTick } from "./society-context.ts";
import { type Field, isWorthLookingFor, knows, type ScarceResource, type Tribe } from "./tribe.ts";
import { completedBuilding } from "./tribe-places.ts";

const LOW_CAMPFIRE_FUEL = 0.45;
const ELDER_HEAVY_WORK = 0.25;
const PRE_WINTER_SEASON = 1.6;
const HEAVY_WORK: ReadonlySet<JobKind> = new Set(["chop", "hunt", "quarry"]);

interface WorkOption {
  kind: JobKind;
  start: (tick: PersonTick) => Job | null;
  weight: (tick: PersonTick) => number;
}

function foodNeed(tick: PersonTick): number {
  const { season } = tick.context.environment;
  const { tribe } = tick;

  const daysOfFood = season >= PRE_WINTER_SEASON ? 7 : 4;

  const target = tribe.memberIds.length * daysOfFood + 6;

  return Math.max(0.15, 1 - tribe.stock.food / target);
}

function constructionSite(tick: PersonTick): Building | null {
  return tick.context.buildings.find(tick.tribe.buildings.constructionSiteId);
}

function constructionCost(tick: PersonTick, material: "stone" | "wood"): number {
  const site = constructionSite(tick);

  if (site !== null) {
    return BUILDINGS[site.kind][material];
  }

  const planned = plannedBuilding(tick.tribe, tick.context);

  if (planned === null) {
    return 0;
  }

  return BUILDINGS[planned][material];
}

function woodNeed(tick: PersonTick): number {
  const fireWood = knows(tick.tribe, "fire") ? 4 : 0;

  const wanted = 6 + constructionCost(tick, "wood") + fireWood;

  return Math.max(0.1, 1 - tick.tribe.stock.wood / wanted);
}

function plannedTotemStone(tribe: Tribe): number {
  if (!knows(tribe, "totem") || tribe.buildings.totemId !== null) {
    return 0;
  }

  return 2;
}

function stoneWanted(tick: PersonTick): number {
  const { tribe } = tick;

  const hasTents = tribe.buildings.shelterIds.some((id) => tick.context.buildings.find(id)?.kind === "tent");

  return constructionCost(tick, "stone") + (hasTents ? 4 : 0) + plannedTotemStone(tribe) + 2;
}

function isWorthIt(tick: PersonTick, resource: ScarceResource, patience: number): boolean {
  return isWorthLookingFor(tick.tribe, resource, tick.context.environment.day, patience);
}

export function neediestField(tribe: Tribe, season: number): Field | null {
  let neediest: Field | null = null;
  let neediestScore = Number.POSITIVE_INFINITY;

  for (const field of tribe.fields) {
    const score = field.tending - (isHarvestTime(field, season) ? 2 : 0);

    if (score < neediestScore) {
      neediest = field;
      neediestScore = score;
    }
  }

  return neediest;
}

const WORK_OPTIONS: readonly WorkOption[] = [
  {
    kind: "build",
    start: (tick) => {
      const site = constructionSite(tick);

      if (site === null) {
        return null;
      }

      return new BuildJob(tick, site);
    },
    weight: (tick) => (constructionSite(tick) === null ? 0 : 6),
  },
  {
    kind: "tend",
    start: (tick) => {
      const campfire = completedBuilding(tick.context.buildings, tick.tribe.buildings.campfireId);

      if (campfire === null || tick.tribe.stock.wood < 1) {
        return null;
      }

      return new TendJob(tick, campfire);
    },
    weight: (tick) => {
      const campfire = completedBuilding(tick.context.buildings, tick.tribe.buildings.campfireId);

      if (campfire === null || campfire.fuel >= LOW_CAMPFIRE_FUEL || tick.tribe.stock.wood < 1) {
        return 0;
      }

      return 9;
    },
  },
  {
    kind: "gather",
    start: findBerries,
    weight: (tick) => {
      if (isWinter(tick.context.environment.season) || !isWorthIt(tick, "berries", 0.3)) {
        return 0;
      }

      return 4 * foodNeed(tick);
    },
  },
  {
    kind: "hunt",
    start: findGame,
    weight: (tick) => {
      if (!(knows(tick.tribe, "spear") && isWorthIt(tick, "game", 0.4))) {
        return 0;
      }

      return 3.2 * foodNeed(tick) + (isWinter(tick.context.environment.season) ? 1.5 : 0);
    },
  },
  {
    kind: "fish",
    start: findFishingSpot,
    weight: (tick) => {
      if (!(knows(tick.tribe, "fishing") && isWorthIt(tick, "fish", 0.5))) {
        return 0;
      }

      return 2.6 * foodNeed(tick);
    },
  },
  {
    kind: "farm",
    start: (tick) => {
      const field = neediestField(tick.tribe, tick.context.environment.season);

      if (field === null) {
        return null;
      }

      return new FarmJob(tick, field);
    },
    weight: (tick) => {
      if (tick.tribe.fields.length === 0 || isWinter(tick.context.environment.season)) {
        return 0;
      }

      return 2.5;
    },
  },
  {
    kind: "chop",
    start: findTree,
    weight: (tick) => {
      if (!isWorthIt(tick, "wood", 0.4)) {
        return 0;
      }

      return 2.5 * woodNeed(tick);
    },
  },
  {
    kind: "quarry",
    start: findStone,
    weight: (tick) => {
      const wanted = stoneWanted(tick);

      if (!(knows(tick.tribe, "huts") && isWorthIt(tick, "stone", 0.5)) || tick.tribe.stock.stone >= wanted) {
        return 0;
      }

      return 1.6 * (1 - tick.tribe.stock.stone / wanted);
    },
  },
  {
    kind: "pray",
    start: (tick) => {
      const totem = completedBuilding(tick.context.buildings, tick.tribe.buildings.totemId);

      if (totem === null) {
        return null;
      }

      return new PrayJob(tick, totem);
    },
    weight: (tick) => {
      if (completedBuilding(tick.context.buildings, tick.tribe.buildings.totemId) === null) {
        return 0;
      }

      return isElder(tick.person) ? 2 : 0.4;
    },
  },
];

function adjustedWeight(option: WorkOption, tick: PersonTick): number {
  const weight = option.weight(tick);

  if (isElder(tick.person) && HEAVY_WORK.has(option.kind)) {
    return weight * ELDER_HEAVY_WORK;
  }

  return weight;
}

export function chooseWork(tick: PersonTick): Job | null {
  const candidates = WORK_OPTIONS.map((option) => ({ option, weight: adjustedWeight(option, tick) }));

  const weighted = candidates.filter((candidate) => candidate.weight > 0);

  const totalWeight = weighted.reduce((total, candidate) => total + candidate.weight, 0);

  if (totalWeight <= 0) {
    return null;
  }

  let remaining = tick.context.random.next() * totalWeight;

  for (const candidate of weighted) {
    remaining -= candidate.weight;

    if (remaining <= 0) {
      return candidate.option.start(tick);
    }
  }

  return null;
}
