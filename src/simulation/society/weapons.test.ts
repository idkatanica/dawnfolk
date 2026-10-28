import { describe, expect, it } from "vitest";
import { firstMemberTick, MORNING, SocietyHarness, settle } from "../testing/test-society.ts";
import { findGame } from "./jobs/hunt-job.ts";
import type { Job } from "./jobs/job.ts";
import { armForHunt, carriedWeapon, hasWeaponsToHunt } from "./weapons.ts";

describe("weapons", () => {
  it("are carried by nobody until a hunter takes one from the stock", () => {
    const harness = new SocietyHarness({ day: MORNING });

    const tribe = settle(harness, 3);
    const tick = firstMemberTick(harness, tribe);

    expect(carriedWeapon(tick.person)).toEqual({ kind: "none" });
    expect(hasWeaponsToHunt(tribe)).toBe(false);

    tribe.stock.spears = 2;
    tribe.armory = "copper";

    expect(armForHunt(tick.person, tribe)).toEqual({ kind: "spear", material: "copper" });
    expect(carriedWeapon(tick.person)).toEqual({ kind: "spear", material: "copper" });
    expect(tribe.stock.spears).toBe(1);
  });

  it("are traded for a bow when the tribe has bows and arrows", () => {
    const harness = new SocietyHarness({ day: MORNING });

    const tribe = settle(harness, 3);
    const tick = firstMemberTick(harness, tribe);

    tribe.technologies.add("archery");
    tribe.stock.bows = 1;
    tribe.stock.arrows = 12;
    tribe.armory = "bronze";

    expect(armForHunt(tick.person, tribe)).toEqual({ kind: "bow", material: "bronze" });
  });
});

describe("hunting with bows", () => {
  it("shoots arrows at the game from range and spends them", () => {
    const harness = new SocietyHarness({ day: MORNING });

    const tribe = settle(harness, 3);
    const tick = firstMemberTick(harness, tribe);

    tribe.technologies.add("spear");
    tribe.technologies.add("archery");
    tribe.stock.bows = 1;
    tribe.stock.arrows = 30;

    const herd = harness.fauna.spawnHerd("deer", tribe.campX + 30, tribe.campZ, 1, harness.random);

    if (herd === null) {
      throw new Error("Expected a deer");
    }

    tick.person.mover.x = tribe.campX - 10;
    tick.person.mover.z = tribe.campZ;

    let job: Job | null = findGame(tick);

    const poses = new Set<string>();

    for (let elapsed = 0; elapsed < 40 && job !== null; elapsed += tick.seconds) {
      job = job.update(tick);
      poses.add(tick.person.pose);
    }

    const arrows = harness.context.effects.takeEffects().filter((effect) => effect.kind === "arrow");

    expect(poses).toContain("shoot");
    expect(arrows.length).toBeGreaterThan(0);
    expect(tribe.stock.arrows).toBe(30 - arrows.length);
  });
});
