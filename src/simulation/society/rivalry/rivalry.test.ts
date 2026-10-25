import { describe, expect, it } from "vitest";
import { worldRulesSchema } from "../../../content/world-rules.ts";
import { armTribe, foundTribe, runUntil, setFood } from "../../testing/test-rivalry.ts";
import { SocietyHarness, tickFor } from "../../testing/test-society.ts";
import type { Building } from "../buildings.ts";
import { assignJob } from "../decisions.ts";
import { FleeJob } from "../jobs/flee-job.ts";
import type { Job } from "../jobs/job.ts";
import { totalFood } from "../stock.ts";
import type { Tribe } from "../tribe.ts";
import type { CarriedWeapon } from "../weapons.ts";
import { FightJob } from "./defense-jobs.ts";
import { personFoe } from "./foes.ts";
import { burnableBuilding, type RaidPhase, rationsFor } from "./raids.ts";
import { sideOf } from "./relations.ts";
import { strike } from "./strikes.ts";
import { wallCover } from "./walls.ts";

const MORNING = 0.3;
const QUIVER = 10;
const SPEAR: CarriedWeapon = { kind: "spear", material: "stone" };
const BOW: CarriedWeapon = { kind: "bow", material: "stone" };
const BARE_HANDS: CarriedWeapon = { kind: "none" };
const SPRING_HARNESS = { day: MORNING, world: { dimensions: { cellSize: 10, cellsPerSide: 96 } } };
const FEUD_STORY = /^feud: The .+ became enemies over/;
const RAID_SENT_STORY = /^raid: The .+ sent \d warriors against the .+/;
const RAID_OUTCOME_STORY = /^raid: The .+ (raided|drove off a raid by) the .+/;
const PLUNDER_STORY = /^raid: The .+ raided the .+: carried off/;
const SLAIN_STORY = /was slain by the/;
const GIFTS_STORY = /^peace: The .+ brought gifts to the .+, and they made peace/;
const TRUCE_STORY = /^peace: .+ agreed to a truce/;

function neighbours(harness: SocietyHarness, distance: number): readonly [Tribe, Tribe] {
  const first = foundTribe(harness, { adults: 8, children: 2, x: -distance / 2, z: 0 });
  const second = foundTribe(harness, { adults: 6, children: 2, x: distance / 2, z: 0 });

  return [first, second];
}

function standStill(): Job {
  const job: Job = { kind: "idle", update: () => job };

  return job;
}

function enclosure(kind: "palisade" | "stoneWall", tribe: Tribe, extent: number): Building {
  return {
    burningSeconds: 0,
    cell: 0,
    cells: [],
    depositId: -1,
    extent,
    fuel: 1,
    health: 200,
    id: tribe.id * 100,
    isRetiring: false,
    kind,
    progress: 1,
    replacesId: null,
    rotation: 0,
    seed: 0.5,
    style: 0,
    tribeId: tribe.id,
    x: tribe.campX,
    z: tribe.campZ,
  };
}

function chronicleTexts(harness: SocietyHarness): string[] {
  return harness.chronicle.takeEntries().map((entry) => `${entry.category}: ${entry.text}`);
}

describe("relations between tribes", () => {
  it("sour into a feud when their lands and hunting grounds overlap", () => {
    const quarrelsome = worldRulesSchema.parse({ life: { rivalry: 3 } });
    const harness = new SocietyHarness({ ...SPRING_HARNESS, rules: quarrelsome });

    const [first, second] = neighbours(harness, 480);

    runUntil(harness, 2400, () => harness.rivalry.relations.find(first.id, second.id)?.stance === "hostile");

    const relation = harness.rivalry.relations.find(first.id, second.id);

    expect(relation?.stance).toBe("hostile");
    expect(chronicleTexts(harness)).toContainEqual(expect.stringMatching(FEUD_STORY));
  });

  it("anger the tribe whose land a stranger hunts on", () => {
    const harness = new SocietyHarness(SPRING_HARNESS);

    const first = foundTribe(harness, { adults: 2, children: 0, x: -420, z: 0 });
    const second = foundTribe(harness, { adults: 2, children: 0, x: 420, z: 0 });
    const [poacher] = harness.society.membersOf(first);

    poacher.mover.x = second.campX + 40;
    poacher.mover.z = second.campZ;
    poacher.job = { kind: "hunt", update: () => poacher.job };
    harness.run(4);

    const relation = harness.rivalry.relations.find(first.id, second.id);

    expect(relation?.lastGrudge).toBe("hunting");
    expect(relation === null ? 0 : sideOf(relation, second.id).grievance).toBeGreaterThan(0);
    expect(relation === null ? 0 : sideOf(relation, first.id).grievance).toBe(0);
  });

  it("start friendly with the tribe they split from", () => {
    const harness = new SocietyHarness(SPRING_HARNESS);

    const [parent, offshoot] = neighbours(harness, 900);

    offshoot.originId = parent.id;
    harness.run(3);

    const relation = harness.rivalry.relations.find(parent.id, offshoot.id);

    expect(relation?.isKin).toBe(true);
    expect(relation?.stance).toBe("friendly");
  });
});

describe("a raid", () => {
  it("musters, marches, fights at the enemy camp and comes home to tell of it", () => {
    const harness = new SocietyHarness(SPRING_HARNESS);

    const [raiders, victims] = neighbours(harness, 420);

    armTribe(raiders, 200);
    armTribe(victims, 60);

    const raid = harness.rivalry.launchRaid(raiders, victims, harness.context);

    expect(raid).not.toBeNull();
    expect(raid?.warriorIds.length).toBeGreaterThanOrEqual(3);

    const phases = new Set<RaidPhase>();
    const victimJobs = new Set<string>();

    runUntil(harness, 900, () => {
      for (const current of harness.rivalry.raids) {
        phases.add(current.phase);
      }

      for (const person of harness.society.membersOf(victims)) {
        victimJobs.add(String(person.job?.kind));
      }

      return harness.rivalry.raids.length === 0;
    });

    const story = chronicleTexts(harness);

    expect([...phases]).toEqual(["muster", "march", "assault", "retreat"]);
    expect(harness.rivalry.raids).toHaveLength(0);
    expect(victimJobs).toContain("defend");
    expect(victimJobs).toContain("hide");
    expect(story).toContainEqual(expect.stringMatching(RAID_SENT_STORY));
    expect(story).toContainEqual(expect.stringMatching(RAID_OUTCOME_STORY));
  });

  it("brings plunder home when the camp is left undefended", () => {
    const harness = new SocietyHarness(SPRING_HARNESS);

    const raiders = foundTribe(harness, { adults: 8, children: 0, x: -200, z: 0 });
    const victims = foundTribe(harness, { adults: 0, children: 4, x: 200, z: 0 });

    armTribe(raiders, 200);
    setFood(victims, 80);
    victims.stock.wood = 30;

    harness.rivalry.launchRaid(raiders, victims, harness.context);
    runUntil(harness, 900, () => harness.rivalry.raids.length === 0);

    const story = chronicleTexts(harness);

    expect(totalFood(victims.stock)).toBeLessThan(80);
    expect(story).toContainEqual(expect.stringMatching(PLUNDER_STORY));
  });

  it("brings plunder home from a camp too far to reach before the retreat ends", () => {
    const harness = new SocietyHarness({
      ...SPRING_HARNESS,
      world: { dimensions: { cellSize: 10, cellsPerSide: 160 } },
    });

    const raiders = foundTribe(harness, { adults: 8, children: 0, x: -550, z: 0 });
    const victims = foundTribe(harness, { adults: 0, children: 4, x: 550, z: 0 });

    armTribe(raiders, 200);
    setFood(victims, 80);
    victims.stock.copper = 30;

    const raid = harness.rivalry.launchRaid(raiders, victims, harness.context);

    runUntil(harness, 1500, () => harness.rivalry.raids.length === 0);
    runUntil(harness, 600, () => harness.society.membersOf(raiders).every((person) => person.job?.kind !== "raid"));

    expect(raid?.loot.copper).toBeGreaterThan(0);
    expect(raiders.stock.copper).toBe(raid?.loot.copper);
  });

  it("sets fire only to what can burn", () => {
    const harness = new SocietyHarness(SPRING_HARNESS);

    const [victims] = neighbours(harness, 900);

    const wall = enclosure("stoneWall", victims, 40);
    const palisade = enclosure("palisade", victims, 40);

    expect(burnableBuilding([wall], victims)).toBeNull();
    expect(burnableBuilding([wall, palisade], victims)).toBe(palisade);
  });

  it("stays home in winter", () => {
    const harness = new SocietyHarness({ ...SPRING_HARNESS, day: 10.4 });

    const [first, second] = neighbours(harness, 420);

    const relation = harness.rivalry.relations.meet(first.id, second.id, false);

    armTribe(first, 300);
    relation.standing = -100;
    relation.stance = "hostile";
    sideOf(relation, first.id).grievance = 200;
    harness.run(60);

    expect(harness.rivalry.raids).toHaveLength(0);
  });
});

describe("combat", () => {
  it("lets a spearman get the better of a bare-handed fighter", () => {
    const harness = new SocietyHarness(SPRING_HARNESS);

    const [first, second] = neighbours(harness, 900);
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

  it("blocks some blows of a fighter facing the attack and lets others through", () => {
    const harness = new SocietyHarness(SPRING_HARNESS);

    const [first, second] = neighbours(harness, 900);
    const [attacker] = harness.society.membersOf(first);
    const [defender] = harness.society.membersOf(second);

    defender.mover.x = attacker.mover.x;
    defender.mover.z = attacker.mover.z + 2;
    defender.mover.heading = Math.PI;
    defender.job = new FightJob(tickFor(harness, defender, second), personFoe(attacker), SPEAR);

    const outcomes = Array.from({ length: 60 }, () => {
      defender.health = 1;
      harness.rivalry.ledger.update(5);

      return strike(attacker, SPEAR, personFoe(defender), harness.rivalry, harness.context);
    });

    expect(outcomes).toContain("blocked");
    expect(outcomes).toContain("hit");
    expect(outcomes).toContain("missed");
  });

  it("looses arrows that fly before they wound", () => {
    const harness = new SocietyHarness(SPRING_HARNESS);

    const [first, second] = neighbours(harness, 900);
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

    const [first, second] = neighbours(harness, 900);
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

  it("shelters defenders behind their own wall", () => {
    const harness = new SocietyHarness(SPRING_HARNESS);

    const [first, second] = neighbours(harness, 900);
    const [defender] = harness.society.membersOf(first);
    const [raider] = harness.society.membersOf(second);

    const palisade = enclosure("palisade", first, 40);
    const wall = enclosure("stoneWall", first, 40);

    raider.mover.x = first.campX + 60;
    raider.mover.z = first.campZ;
    defender.mover.x = first.campX + 10;
    defender.mover.z = first.campZ;

    expect(wallCover(defender, raider, [])).toBe(0);
    expect(wallCover(defender, raider, [palisade])).toBeGreaterThan(0);
    expect(wallCover(defender, raider, [palisade, wall])).toBeGreaterThan(wallCover(defender, raider, [palisade]));
    expect(wallCover(raider, defender, [palisade])).toBe(0);
  });

  it("records the fallen and the blood feud they leave behind", () => {
    const harness = new SocietyHarness(SPRING_HARNESS);

    const [first, second] = neighbours(harness, 900);
    const [slayer] = harness.society.membersOf(first);
    const [victim] = harness.society.membersOf(second);

    harness.rivalry.relations.meet(first.id, second.id, false);
    victim.health = 0.05;
    victim.mover.x = slayer.mover.x + 1;
    victim.mover.z = slayer.mover.z;

    for (let attempt = 0; attempt < 20 && victim.isAlive; attempt += 1) {
      strike(slayer, SPEAR, personFoe(victim), harness.rivalry, harness.context);
    }

    const relation = harness.rivalry.relations.find(first.id, second.id);

    expect(victim.isAlive).toBe(false);
    expect(victim.causeOfDeath).toBe("battle");
    expect(victim.pose).toBe("fall");
    expect(relation?.lastGrudge).toBe("blood");
    expect(relation === null ? 0 : sideOf(relation, second.id).deaths).toBe(1);
    expect(chronicleTexts(harness)).toContainEqual(expect.stringMatching(SLAIN_STORY));

    harness.run(2);

    expect(victim.pose).toBe("dead");
  });
});

describe("peace", () => {
  it("comes with gifts carried by an envoy after a long and costly feud", () => {
    const harness = new SocietyHarness(SPRING_HARNESS);

    const [first, second] = neighbours(harness, 420);

    const relation = harness.rivalry.relations.meet(first.id, second.id, false);

    setFood(first, 120);
    relation.standing = -90;
    relation.stance = "hostile";
    relation.feudStartDay = -12;
    sideOf(relation, first.id).weariness = 120;
    sideOf(relation, second.id).weariness = 40;

    runUntil(harness, 200, () => relation.envoyId !== null);

    expect(relation.envoyId).not.toBeNull();

    const hostFood = totalFood(second.stock);

    runUntil(harness, 600, () => relation.stance !== "hostile");

    expect(relation.stance).toBe("neutral");
    expect(relation.truceUntilDay).toBeGreaterThan(harness.calendar.day);
    expect(totalFood(second.stock)).toBeGreaterThan(hostFood);
    expect(chronicleTexts(harness)).toContainEqual(expect.stringMatching(GIFTS_STORY));
  });

  it("keeps the gifts at home until the envoy reaches the other camp", () => {
    const harness = new SocietyHarness(SPRING_HARNESS);

    const [first, second] = neighbours(harness, 420);

    const relation = harness.rivalry.relations.meet(first.id, second.id, false);

    setFood(first, 120);
    relation.standing = -90;
    relation.stance = "hostile";
    relation.feudStartDay = -12;
    sideOf(relation, first.id).weariness = 120;
    sideOf(relation, second.id).weariness = 40;

    let seekerFood = totalFood(first.stock);

    runUntil(harness, 200, () => {
      if (relation.envoyId === null) {
        seekerFood = totalFood(first.stock);
      }

      return relation.envoyId !== null;
    });

    const envoy = harness.society.membersOf(first).find((person) => person.id === relation.envoyId);

    if (envoy === undefined) {
      throw new Error("Expected an envoy on the way");
    }

    const tick = tickFor(harness, envoy, first);
    const rations = rationsFor(420, harness.context.rules.life.hungerRate);

    assignJob(tick, new FleeJob(tick, { x: envoy.mover.x + 5, z: envoy.mover.z }));
    harness.step();

    expect(envoy.job?.kind).toBe("flee");
    expect(totalFood(first.stock)).toBeGreaterThan(seekerFood - rations - 1);
  });

  it("is a bare truce when the weary tribe has nothing to give", () => {
    const harness = new SocietyHarness(SPRING_HARNESS);

    const [first, second] = neighbours(harness, 420);

    const relation = harness.rivalry.relations.meet(first.id, second.id, false);

    setFood(first, 0);
    setFood(second, 0);
    relation.standing = -90;
    relation.stance = "hostile";
    relation.feudStartDay = -12;
    sideOf(relation, first.id).weariness = 120;

    runUntil(harness, 400, () => {
      setFood(first, 0);

      return relation.stance !== "hostile";
    });

    expect(relation.stance).toBe("neutral");
    expect(chronicleTexts(harness)).toContainEqual(expect.stringMatching(TRUCE_STORY));
  });
});

describe("determinism", () => {
  function replay(): string[] {
    const harness = new SocietyHarness(SPRING_HARNESS);

    const [raiders, victims] = neighbours(harness, 420);

    armTribe(raiders, 200);
    armTribe(victims, 60);
    harness.rivalry.launchRaid(raiders, victims, harness.context);
    harness.run(240);

    return [
      ...harness.chronicle.takeEntries().map((entry) => entry.text),
      ...harness.society.people.map(
        (person) => `${person.id} ${person.mover.x.toFixed(4)} ${person.mover.z.toFixed(4)} ${person.health.toFixed(4)}`
      ),
    ];
  }

  it("fights the same raid the same way for the same seed", () => {
    expect(replay()).toEqual(replay());
  });
});
