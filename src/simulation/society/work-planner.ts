import { isWinter } from "../../content/seasons.ts";
import type { Building } from "./buildings.ts";
import { constructionNeed } from "./construction.ts";
import { ERA_WORK_OPTIONS } from "./era-work.ts";
import { type FieldTask, fieldTask, neediestField } from "./farming.ts";
import { BuildJob, isExpeditionSeason, isFarSite } from "./jobs/build-job.ts";
import { findTree } from "./jobs/chop-job.ts";
import { FarmJob } from "./jobs/farm-job.ts";
import { findFishingSpot } from "./jobs/fish-job.ts";
import { findBerries } from "./jobs/gather-job.ts";
import { findGame } from "./jobs/hunt-job.ts";
import type { Job, JobKind } from "./jobs/job.ts";
import { PrayJob } from "./jobs/pray-job.ts";
import { findStone } from "./jobs/quarry-job.ts";
import { TendJob } from "./jobs/tend-job.ts";
import { isElder } from "./person.ts";
import type { PersonTick } from "./society-context.ts";
import { totalFood } from "./stock.ts";
import { type Field, knows } from "./tribe.ts";
import { completedBuilding } from "./tribe-places.ts";
import { hasWeaponsToHunt } from "./weapons.ts";
import { foodNeed, isWorthIt, type WorkOption } from "./work-needs.ts";

const LOW_CAMPFIRE_FUEL = 0.45;
const ELDER_HEAVY_WORK = 0.25;
const HEAVY_WORK: ReadonlySet<JobKind> = new Set(["chop", "hunt", "mine", "quarry"]);
const CRAFTING_WOOD = 8;
const FIELD_TASK_WEIGHTS: Readonly<Record<FieldTask | "none", number>> = { harvest: 3.6, none: 0, sow: 2.6, tend: 1 };
const MASONRY_STONE = 24;
const FIRE_WOOD = 4;
const LARGEST_BUILDING_PARTY = 4;
const EXPEDITION_MEALS_PER_PERSON = 2;
const COLD_SEASON_FIRE_WOOD = 12;
const AUTUMN = 2;

function expeditionBuilders(tick: PersonTick): number {
  return tick.context.people
    .membersOf(tick.tribe)
    .filter((member) => member.job !== null && member.job.kind === "build" && member.job.isExpedition === true).length;
}

function constructionSite(tick: PersonTick): Building | null {
  return tick.context.buildings.find(tick.tribe.buildings.constructionSiteId);
}

function fieldTaskOf(tick: PersonTick, field: Field): FieldTask | "none" {
  const task = fieldTask(tick.tribe, field, tick.context.environment.season);

  if (task === null) {
    return "none";
  }

  return task;
}

function fireWoodReserve(season: number): number {
  if (season >= AUTUMN) {
    return COLD_SEASON_FIRE_WOOD;
  }

  return FIRE_WOOD;
}

function woodNeed(tick: PersonTick): number {
  const { tribe } = tick;

  const fireWood = knows(tribe, "fire") ? fireWoodReserve(tick.context.environment.season) : 0;
  const craftWood = knows(tribe, "pottery") ? CRAFTING_WOOD : 0;

  const wanted = 6 + constructionNeed(tribe, tick.context, "wood") + fireWood + craftWood;

  return Math.max(0.1, 1 - tribe.stock.wood / wanted);
}

function stoneWanted(tick: PersonTick): number {
  const { tribe } = tick;

  const reserve = knows(tribe, "masonry") ? MASONRY_STONE : 4;

  return constructionNeed(tribe, tick.context, "stone") + reserve + 2;
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
    weight: (tick) => {
      const site = constructionSite(tick);

      if (site === null) {
        return 0;
      }

      if (!isFarSite(tick.tribe, site)) {
        return 6;
      }

      const isUnprovisioned = totalFood(tick.tribe.stock) < tick.tribe.memberCount * EXPEDITION_MEALS_PER_PERSON;

      if (
        !isExpeditionSeason(tick.context.environment.season) ||
        expeditionBuilders(tick) >= LARGEST_BUILDING_PARTY ||
        isUnprovisioned
      ) {
        return 0;
      }

      return 6;
    },
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
      const isArmed = tick.person.weapon !== null || hasWeaponsToHunt(tick.tribe);

      if (!(knows(tick.tribe, "spear") && isArmed && isWorthIt(tick, "game", 0.4))) {
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
      const { season } = tick.context.environment;

      const field = neediestField(tick.tribe, season);

      if (field === null) {
        return 0;
      }

      return FIELD_TASK_WEIGHTS[fieldTaskOf(tick, field)];
    },
  },
  {
    kind: "chop",
    start: findTree,
    weight: (tick) => {
      if (!isWorthIt(tick, "wood", 0.4)) {
        return 0;
      }

      return 3.4 * woodNeed(tick);
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

      return 2.2 * (1 - tick.tribe.stock.stone / wanted);
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
  ...ERA_WORK_OPTIONS,
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
