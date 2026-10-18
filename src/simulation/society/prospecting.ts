import { DEPOSIT_KINDS, DEPOSITS, type DepositKind } from "../../content/deposits.ts";
import type { ResourceKind } from "../../content/resources.ts";
import type { Deposit } from "../../world/deposits.ts";
import type { Waypoint } from "../agents/navigation.ts";
import { nearestDeposit } from "./camp-plan.ts";
import type { SocietyContext } from "./society-context.ts";
import { totalFood } from "./stock.ts";
import { type Tribe, upcomingTechnology } from "./tribe.ts";
import { campPoint } from "./tribe-places.ts";

const SETTLED_DAYS_BEFORE_PROSPECTING = 8;
const FOOD_PER_MEMBER_FOR_THE_ROAD = 8;
const CANDIDATE_DEPOSITS = 6;
const LATEST_SEASON_TO_TRAVEL = 1.2;
const FARTHEST_JOURNEY = 2200;

export interface ProspectingMove {
  kind: DepositKind;
  origin: Waypoint;
  reason: string;
}

function depositKindFor(resource: ResourceKind): DepositKind | null {
  const kind = DEPOSIT_KINDS.find((candidate) => DEPOSITS[candidate].resource === resource);

  if (kind === undefined) {
    return null;
  }

  return kind;
}

function isReadyToTravel(tribe: Tribe, context: SocietyContext): boolean {
  const { day, season } = context.environment;

  if (day - tribe.migrationStartDay < SETTLED_DAYS_BEFORE_PROSPECTING || season > LATEST_SEASON_TO_TRAVEL) {
    return false;
  }

  return totalFood(tribe.stock) >= tribe.memberIds.length * FOOD_PER_MEMBER_FOR_THE_ROAD;
}

function promisingDeposit(context: SocietyContext, kind: DepositKind, from: Waypoint): Deposit | null {
  const candidates = context.world.deposits
    .filter((deposit) => deposit.kind === kind && Math.hypot(deposit.x - from.x, deposit.z - from.z) < FARTHEST_JOURNEY)
    .sort(
      (first, second) =>
        Math.hypot(first.x - from.x, first.z - from.z) - Math.hypot(second.x - from.x, second.z - from.z)
    )
    .slice(0, CANDIDATE_DEPOSITS);

  const withClay = candidates.find(
    (deposit) => nearestDeposit(context.world, "clay", deposit, DEPOSITS.clay.reach) !== null
  );

  if (withClay !== undefined) {
    return withClay;
  }

  const [nearest] = candidates;

  if (nearest === undefined) {
    return null;
  }

  return nearest;
}

export function prospectingMove(tribe: Tribe, context: SocietyContext): ProspectingMove | null {
  const goal = upcomingTechnology(tribe);

  if (goal === undefined || goal.needs === null || !isReadyToTravel(tribe, context)) {
    return null;
  }

  const kind = depositKindFor(goal.needs.resource);

  if (kind === null || nearestDeposit(context.world, kind, campPoint(tribe), DEPOSITS[kind].reach) !== null) {
    return null;
  }

  const deposit = promisingDeposit(context, kind, campPoint(tribe));

  if (deposit === null) {
    return null;
  }

  return {
    kind,
    origin: { x: deposit.x, z: deposit.z },
    reason: `they went to look for ${DEPOSITS[kind].name.toLowerCase()}s`,
  };
}
