import { describe, expect, it } from "vitest";
import { PlantSpecies } from "../../../content/plants.ts";
import {
  FACING_TOLERANCE,
  placementAt,
  plantNear,
  WORK_SPOT_TOLERANCE,
  workUntilPosed,
} from "../../testing/test-jobs.ts";
import { firstMemberTick, MORNING, SocietyHarness, settle } from "../../testing/test-society.ts";
import { findTree } from "./chop-job.ts";

describe("chopping trees", () => {
  it("chops a tree from arm's reach of the trunk, facing it", () => {
    const harness = new SocietyHarness({ day: MORNING });

    const tick = firstMemberTick(harness, settle(harness, 1));

    plantNear(tick, PlantSpecies.Oak, 16);

    const job = findTree(tick);

    if (job === null) {
      throw new Error("Expected a tree to chop");
    }

    workUntilPosed(job, tick, "chop");

    const placement = placementAt(tick, job.claimedPlant, 0.75);

    expect(placement.missedBy).toBeLessThan(WORK_SPOT_TOLERANCE);
    expect(placement.turnedAwayBy).toBeLessThan(FACING_TOLERANCE);
  });
});
