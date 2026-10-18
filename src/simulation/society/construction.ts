import { BUILDINGS, type BuildingKind } from "../../content/buildings.ts";
import { Ground, groundDefinition } from "../../content/grounds.ts";
import { FULL_TURN } from "../../shared/math.ts";
import { aroundPoint, type Waypoint } from "../agents/navigation.ts";
import { NO_BUILDING } from "../world/world-state.ts";
import type { Building, BuildingLoss } from "./buildings.ts";
import type { SocietyContext } from "./society-context.ts";
import { BASE_HOUSING, knows, learn, type Tribe } from "./tribe.ts";
import { completedBuilding } from "./tribe-places.ts";

const MAXIMUM_SHELTERS = 12;
const MAXIMUM_FIELDS = 10;
const PLACEMENT_ATTEMPTS = 30;
const FIELD_ATTEMPTS = 40;
const FIELD_SLOPE = 0.3;
const FERTILE_GROUND = 0.4;
const CAMPFIRE_SPACING = 4;
const BUILDING_SPACING = 9;

type BuildingSlot = "campfire" | "shelter" | "storehouse" | "totem";

interface BuildingPlan {
  farthest: number;
  kind: BuildingKind;
  nearest: number;
  replacesTentId: number | null;
  slot: BuildingSlot;
}

function completedShelters(tribe: Tribe, context: SocietyContext): Building[] {
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

export function canAfford(tribe: Tribe, kind: BuildingKind): boolean {
  const { stone, wood } = BUILDINGS[kind];

  return tribe.stock.wood >= wood && tribe.stock.stone >= stone;
}

export function planConstruction(tribe: Tribe, context: SocietyContext): void {
  if (tribe.buildings.constructionSiteId !== null || tribe.isMigrating) {
    return;
  }

  const plan = nextBuildingPlan(tribe, context);

  if (plan === null) {
    addFieldIfNeeded(tribe, context);

    return;
  }

  if (!canAfford(tribe, plan.kind)) {
    return;
  }

  const site = placeBuilding(tribe, plan, context);

  if (site !== null) {
    assignSlot(tribe, plan, site, context);
  }
}

export function plannedBuilding(tribe: Tribe, context: SocietyContext): BuildingKind | null {
  const plan = nextBuildingPlan(tribe, context);

  if (plan === null) {
    return null;
  }

  return plan.kind;
}

function nextBuildingPlan(tribe: Tribe, context: SocietyContext): BuildingPlan | null {
  const { buildings } = context;

  const shelterCount = tribe.buildings.shelterIds.length;

  if (knows(tribe, "fire") && buildings.find(tribe.buildings.campfireId) === null) {
    return { farthest: 4, kind: "campfire", nearest: 0, replacesTentId: null, slot: "campfire" };
  }

  if (needsShelter(tribe, context)) {
    const kind = knows(tribe, "huts") ? "hut" : "tent";

    return { farthest: 24 + shelterCount * 1.5, kind, nearest: 11, replacesTentId: null, slot: "shelter" };
  }

  if (knows(tribe, "storage") && buildings.find(tribe.buildings.storehouseId) === null) {
    return { farthest: 12, kind: "storehouse", nearest: 6, replacesTentId: null, slot: "storehouse" };
  }

  const tent = tentToReplace(tribe, context);

  if (tent !== null) {
    return { farthest: 26 + shelterCount * 1.5, kind: "hut", nearest: 12, replacesTentId: tent.id, slot: "shelter" };
  }

  if (knows(tribe, "totem") && buildings.find(tribe.buildings.totemId) === null) {
    return { farthest: 10, kind: "totem", nearest: 5, replacesTentId: null, slot: "totem" };
  }

  return null;
}

function needsShelter(tribe: Tribe, context: SocietyContext): boolean {
  if (!knows(tribe, "shelter") || tribe.buildings.shelterIds.length >= MAXIMUM_SHELTERS) {
    return false;
  }

  return housingCapacity(tribe, context) < tribe.memberIds.length + 2;
}

function tentToReplace(tribe: Tribe, context: SocietyContext): Building | null {
  if (!knows(tribe, "huts")) {
    return null;
  }

  const tent = completedShelters(tribe, context).find((shelter) => shelter.kind === "tent" && !shelter.isRetiring);

  if (tent === undefined) {
    return null;
  }

  return tent;
}

function placeBuilding(tribe: Tribe, plan: BuildingPlan, context: SocietyContext): Building | null {
  const { random } = context;

  for (let attempt = 0; attempt < PLACEMENT_ATTEMPTS; attempt += 1) {
    const angle = random.next() * FULL_TURN;
    const distance = random.between(plan.nearest, plan.farthest);

    const spot = aroundPoint({ x: tribe.campX, z: tribe.campZ }, distance, angle);

    if (isBuildable(spot, plan.kind, context)) {
      return startBuilding(tribe, plan.kind, spot, context);
    }
  }

  return null;
}

function isBuildable(spot: Waypoint, kind: BuildingKind, context: SocietyContext): boolean {
  const { world } = context;

  const cell = world.grid.cellAt(spot.x, spot.z);

  if (!world.isWalkable(cell) || world.occupancy[cell] !== NO_BUILDING) {
    return false;
  }

  if (world.slope(cell) > BUILDINGS[kind].steepestSlope) {
    return false;
  }

  const spacing = kind === "campfire" ? CAMPFIRE_SPACING : BUILDING_SPACING;

  return context.buildings.nearest(spot.x, spot.z, spacing) === null;
}

function startBuilding(tribe: Tribe, kind: BuildingKind, spot: Waypoint, context: SocietyContext): Building {
  const { stone, wood } = BUILDINGS[kind];

  const rotation = Math.atan2(tribe.campX - spot.x, tribe.campZ - spot.z);

  const site = context.buildings.add({ kind, rotation, tribeId: tribe.id, x: spot.x, z: spot.z }, context.random);

  tribe.stock.wood -= wood;
  tribe.stock.stone -= stone;
  tribe.buildings.constructionSiteId = site.id;
  context.world.clearPlants(site.cell, false);

  return site;
}

function assignSlot(tribe: Tribe, plan: BuildingPlan, site: Building, context: SocietyContext): void {
  const { buildings } = tribe;

  switch (plan.slot) {
    case "campfire":
      buildings.campfireId = site.id;
      break;
    case "shelter":
      buildings.shelterIds.push(site.id);
      markTentForRetirement(plan.replacesTentId, context);
      break;
    case "storehouse":
      buildings.storehouseId = site.id;
      break;
    case "totem":
      buildings.totemId = site.id;
      break;
    default:
      throw new Error(`Unknown building slot ${String(plan.slot)}`);
  }
}

function markTentForRetirement(tentId: number | null, context: SocietyContext): void {
  const tent = context.buildings.find(tentId);

  if (tent !== null) {
    tent.isRetiring = true;
  }
}

function addFieldIfNeeded(tribe: Tribe, context: SocietyContext): void {
  const wantedFields = Math.min(MAXIMUM_FIELDS, 2 + tribe.memberIds.length / 2);

  if (!knows(tribe, "farming") || tribe.fields.length >= wantedFields) {
    return;
  }

  const { random, world } = context;

  for (let attempt = 0; attempt < FIELD_ATTEMPTS; attempt += 1) {
    const angle = random.next() * FULL_TURN;
    const distance = random.between(30, 75);

    const cell = world.grid.cellAt(tribe.campX + Math.cos(angle) * distance, tribe.campZ + Math.sin(angle) * distance);

    if (isFarmable(tribe, cell, context)) {
      world.clearPlants(cell, false);
      world.setGround(cell, Ground.Farm);
      tribe.fields.push({ cell, growth: 0, tending: 0 });

      return;
    }
  }
}

function isFarmable(tribe: Tribe, cell: number, context: SocietyContext): boolean {
  const { world } = context;

  if (!world.isWalkable(cell) || world.occupancy[cell] !== NO_BUILDING || world.slope(cell) > FIELD_SLOPE) {
    return false;
  }

  if (groundDefinition(world.terrain.ground[cell]).fertility < FERTILE_GROUND) {
    return false;
  }

  return !tribe.fields.some((field) => field.cell === cell);
}

export function completeConstruction(tribe: Tribe, site: Building, context: SocietyContext): void {
  if (tribe.buildings.constructionSiteId === site.id) {
    tribe.buildings.constructionSiteId = null;
  }

  context.chronicle.record({
    category: "building",
    text: constructionMessage(tribe, site),
    tribeId: tribe.id,
    x: site.x,
    z: site.z,
  });

  if (site.kind === "hut") {
    retireReplacedTent(tribe, context);
  }

  assignHomes(tribe, context);
  learn(tribe, 2, context.rules);
}

function constructionMessage(tribe: Tribe, site: Building): string {
  if (site.kind === "campfire") {
    return `${tribe.name} lit a campfire`;
  }

  return `${tribe.name} built a ${BUILDINGS[site.kind].name.toLowerCase()}`;
}

function retireReplacedTent(tribe: Tribe, context: SocietyContext): void {
  for (const shelterId of tribe.buildings.shelterIds) {
    const shelter = context.buildings.find(shelterId);

    if (shelter?.isRetiring === true) {
      context.buildings.remove(shelter, "replaced");

      return;
    }
  }
}

export function handleBuildingLoss(tribe: Tribe, loss: BuildingLoss, context: SocietyContext): void {
  const { building, reason } = loss;
  const { buildings } = tribe;

  buildings.campfireId = clearedId(buildings.campfireId, building);
  buildings.constructionSiteId = clearedId(buildings.constructionSiteId, building);
  buildings.storehouseId = clearedId(buildings.storehouseId, building);
  buildings.totemId = clearedId(buildings.totemId, building);
  buildings.shelterIds = buildings.shelterIds.filter((shelterId) => shelterId !== building.id);

  if (reason === "burnt" || reason === "destroyed") {
    context.chronicle.record({
      category: "warning",
      text: `${tribe.name} lost their ${BUILDINGS[building.kind].name.toLowerCase()}`,
      tribeId: tribe.id,
      x: building.x,
      z: building.z,
    });
  }

  assignHomes(tribe, context);
}

function clearedId(id: number | null, lost: Building): number | null {
  if (id === lost.id) {
    return null;
  }

  return id;
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
