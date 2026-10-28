import { describe, expect, it } from "vitest";
import { createStripHarness, settle, tickFor } from "../../testing/test-society.ts";
import { assignJob } from "../decisions.ts";
import { WanderJob } from "./wander-job.ts";

describe("staying dry", () => {
  it("sends children to play on dry land", () => {
    const harness = createStripHarness();

    const tribe = settle(harness, 4);

    const [child] = harness.society.membersOf(tribe);

    const tick = tickFor(harness, child, tribe);

    for (let game = 0; game < 30; game += 1) {
      assignJob(tick, new WanderJob(tick, "play"));

      expect(harness.world.isWalkableAt(child.mover.goalX, child.mover.goalZ)).toBe(true);
    }
  });
});
