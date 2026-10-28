import { describe, expect, it } from "vitest";
import { firstMemberTick, MORNING, runToCompletion, SocietyHarness, settle } from "../../testing/test-society.ts";
import { carriedAmount, pickUp } from "../person.ts";
import { TendJob } from "./tend-job.ts";

describe("feeding the campfire", () => {
  it("keeps the wood the tender was already carrying", () => {
    const harness = new SocietyHarness({ day: MORNING });

    const tribe = settle(harness, 3);

    const tick = firstMemberTick(harness, tribe);

    const campfire = harness.buildings.add(
      { kind: "campfire", rotation: 0, tribeId: tribe.id, x: tribe.campX + 2, z: tribe.campZ },
      harness.random
    );

    campfire.progress = 1;
    campfire.fuel = 0.2;
    tribe.stock.wood = 5;
    pickUp(tick.person, "wood", 3, "wood");

    expect(runToCompletion(new TendJob(tick, campfire), tick, 60)).toBe(true);
    expect(campfire.fuel).toBeCloseTo(0.65);
    expect(tribe.stock.wood).toBe(4);
    expect(carriedAmount(tick.person, "wood")).toBe(3);
  });
});
