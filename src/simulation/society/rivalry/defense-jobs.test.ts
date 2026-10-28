import { describe, expect, it } from "vitest";
import { foundNeighboringTribes, runUntil, SPRING_HARNESS, standStill } from "../../testing/test-rivalry.ts";
import { SocietyHarness, tickFor } from "../../testing/test-society.ts";
import type { CarriedWeapon } from "../weapons.ts";
import { FightJob } from "./defense-jobs.ts";
import { personFoe } from "./foes.ts";

const QUIVER = 10;
const SPEAR: CarriedWeapon = { kind: "spear", material: "stone" };
const BOW: CarriedWeapon = { kind: "bow", material: "stone" };
const BARE_HANDS: CarriedWeapon = { kind: "none" };

describe("combat", () => {
  it("lets a spearman get the better of a bare-handed fighter", () => {
    const harness = new SocietyHarness(SPRING_HARNESS);

    const [first, second] = foundNeighboringTribes(harness, 900);
    const [spearman] = harness.society.membersOf(first);
    const [brawler] = harness.society.membersOf(second);

    for (const person of harness.society.people) {
      person.job = standStill();
    }

    brawler.mover.x = spearman.mover.x + 6;
    brawler.mover.z = spearman.mover.z;
    spearman.job = new FightJob(tickFor(harness, spearman, first), personFoe(brawler), SPEAR);
    brawler.job = new FightJob(tickFor(harness, brawler, second), personFoe(spearman), BARE_HANDS);
    runUntil(harness, 40, () => !(spearman.isAlive && brawler.isAlive) || brawler.health < 0.25);

    expect(brawler.health).toBeLessThan(spearman.health);
    expect(brawler.health).toBeLessThan(0.3);
  });

  it("looses arrows that fly before they wound", () => {
    const harness = new SocietyHarness(SPRING_HARNESS);

    const [first, second] = foundNeighboringTribes(harness, 900);
    const [archer] = harness.society.membersOf(first);
    const [target] = harness.society.membersOf(second);

    for (const person of harness.society.people) {
      person.job = standStill();
    }

    first.stock.arrows = QUIVER;
    target.mover.x = archer.mover.x + 15;
    target.mover.z = archer.mover.z;
    archer.job = new FightJob(tickFor(harness, archer, first), personFoe(target), BOW);
    runUntil(harness, 30, () => target.health < 1);

    const arrows = harness.effects.takeEffects().filter((effect) => effect.kind === "arrow");

    expect(arrows.length).toBeGreaterThan(0);
    expect(first.stock.arrows).toBe(QUIVER - arrows.length);
    expect(target.health).toBeLessThan(1);
    expect(archer.pose === "shoot" || archer.pose === "flinch").toBe(true);
  });

  it("closes in bare-handed when the tribe has no arrows left", () => {
    const harness = new SocietyHarness(SPRING_HARNESS);

    const [first, second] = foundNeighboringTribes(harness, 900);
    const [archer] = harness.society.membersOf(first);
    const [target] = harness.society.membersOf(second);

    for (const person of harness.society.people) {
      person.job = standStill();
    }

    first.stock.arrows = 0;
    target.mover.x = archer.mover.x + 15;
    target.mover.z = archer.mover.z;
    archer.job = new FightJob(tickFor(harness, archer, first), personFoe(target), BOW);
    runUntil(harness, 20, () => archer.pose === "brawl");

    expect(harness.effects.takeEffects().some((effect) => effect.kind === "arrow")).toBe(false);
    expect(archer.pose).toBe("brawl");
  });
});
