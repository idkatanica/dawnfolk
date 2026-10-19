import { describe, expect, it } from "vitest";
import { BROOK_STRENGTH } from "../../world/brooks.ts";
import { isHopping } from "../agents/hops.ts";
import { moveAlong } from "../agents/movement.ts";
import { firstMemberTick, SocietyHarness, settle } from "../testing/test-society.ts";
import { riverStrip } from "../testing/test-world.ts";
import { headTo } from "./jobs/job.ts";

const MORNING = 0.3;

describe("hopping over a brook", () => {
  it("keeps going once it has leapt, whatever else comes up", () => {
    const harness = new SocietyHarness({ day: MORNING });
    const tick = firstMemberTick(harness, settle(harness, 1));
    const { person } = tick;

    riverStrip(harness.world, person.mover.x + 8, person.mover.x + 28, BROOK_STRENGTH);
    harness.navigation.rebuild();
    headTo(person, { x: person.mover.x + 70, z: person.mover.z }, harness.context);
    person.job = null;
    person.mover.hopSpeed = 3.75;

    for (let step = 0; step < 200 && !isHopping(person.mover); step += 1) {
      moveAlong(person.mover, 0.1, 2.5, harness.world, harness.navigation);
    }

    expect(isHopping(person.mover)).toBe(true);

    person.hunger = 0.95;

    const poses = new Set<string>();

    let lastX = person.mover.x;
    let hopTicks = 0;

    while (isHopping(person.mover) && hopTicks < 100) {
      harness.step();
      hopTicks += 1;
      poses.add(person.pose);

      expect(person.mover.x).toBeGreaterThan(lastX);
      expect(person.job).toBeNull();

      lastX = person.mover.x;
    }

    expect(isHopping(person.mover)).toBe(false);
    expect(harness.world.isWaterAt(person.mover.x, person.mover.z)).toBe(false);
    expect([...poses].every((pose) => pose === "leap" || pose === "run")).toBe(true);
    expect(poses.has("leap")).toBe(true);
  });
});
