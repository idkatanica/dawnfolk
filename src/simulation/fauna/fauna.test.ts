import { describe, expect, it } from "vitest";
import { ANIMALS } from "../../content/animals.ts";
import { Biome } from "../../content/biomes.ts";
import { DEFAULT_WORLD_RULES } from "../../content/world-rules.ts";
import { createRandom } from "../../shared/random.ts";
import { NavigationGrid, type Waypoint } from "../agents/navigation.ts";
import { IdentifierSource } from "../identifiers.ts";
import { createTestWorld, floodCells } from "../testing/test-world.ts";
import type { WorldState } from "../world/world-state.ts";
import { FaunaSystem, type FaunaThreats, type FaunaTick } from "./fauna.ts";

const NO_THREATS: FaunaThreats = { dangerNear: () => null, hunterNear: () => null };
const SUMMER = 1.6;
const SPRING = 0.5;

function createFauna(world: WorldState = createTestWorld({ dimensions: { cellSize: 10, cellsPerSide: 96 } })) {
  const navigation = new NavigationGrid(world);

  return { fauna: new FaunaSystem(world, navigation, new IdentifierSource()), navigation, world };
}

function tickOf(overrides: Partial<FaunaTick> = {}): FaunaTick {
  return {
    days: 0.1 / 240,
    random: createRandom(4),
    rules: DEFAULT_WORLD_RULES,
    season: SUMMER,
    seconds: 0.1,
    threats: NO_THREATS,
    ...overrides,
  };
}

function runFor(fauna: FaunaSystem, seconds: number, overrides: Partial<FaunaTick> = {}): void {
  const tick = tickOf(overrides);

  for (let elapsed = 0; elapsed < seconds; elapsed += tick.seconds) {
    fauna.update(tick);
  }
}

describe("herds", () => {
  it("spawn on dry land with the requested size", () => {
    const { fauna } = createFauna();

    const herd = fauna.spawnHerd("deer", 0, 0, 5, createRandom(1));

    expect(herd?.memberIds).toHaveLength(5);
    expect(fauna.livingCount).toBe(5);
  });

  it("spread over suitable land when the world is populated", () => {
    const { fauna } = createFauna(
      createTestWorld({ biome: Biome.Forest, dimensions: { cellSize: 10, cellsPerSide: 96 } })
    );

    const created = fauna.populate(4, createRandom(2));

    expect(created).toBe(4);
    expect(fauna.herds.every((herd) => ANIMALS[herd.kind].favouriteBiomes.includes(Biome.Forest))).toBe(true);
  });

  it("wander to new pastures over time", () => {
    const { fauna } = createFauna();

    fauna.spawnHerd("deer", 0, 0, 3, createRandom(1));

    const startX = fauna.animals.map((animal) => animal.mover.x);

    runFor(fauna, 200);

    const moved = fauna.animals.some((animal, index) => Math.abs(animal.mover.x - startX[index]) > 20);

    expect(moved).toBe(true);
  });
});

describe("animals", () => {
  it("run away from danger", () => {
    const { fauna } = createFauna();

    fauna.spawnHerd("deer", 0, 0, 1, createRandom(1));

    const [deer] = fauna.animals;

    const danger: Waypoint = { x: deer.mover.x - 30, z: deer.mover.z };

    runFor(fauna, 3, { threats: { dangerNear: () => danger, hunterNear: () => null } });

    expect(deer.pose).toBe("run");
    expect(deer.mover.x - danger.x).toBeGreaterThan(40);
  });

  it("die in a blast and are cleared away later", () => {
    const { fauna } = createFauna();

    fauna.spawnHerd("deer", 0, 0, 3, createRandom(1));
    fauna.damageArea(0, 0, 100, 10, "blast");

    expect(fauna.livingCount).toBe(0);
    expect(fauna.animals.map((animal) => animal.causeOfDeath)).toEqual(["blast", "blast", "blast"]);

    runFor(fauna, 35);

    expect(fauna.animals).toHaveLength(0);
    expect(fauna.herds).toHaveLength(0);
  });

  it("swim ashore when the water rises around them as they graze", () => {
    const { fauna, navigation, world } = createFauna();

    fauna.spawnHerd("deer", 0, 0, 4, createRandom(1));
    runFor(fauna, 1);
    floodCells(world, world.grid.cellsInRadius(0, 0, 50), 1.6);
    navigation.rebuild();

    expect(fauna.animals.every((animal) => world.isWaterAt(animal.mover.x, animal.mover.z))).toBe(true);

    runFor(fauna, 60);

    expect(fauna.animals.filter((animal) => world.isWaterAt(animal.mover.x, animal.mover.z))).toEqual([]);
  });

  it("burn when standing in flames", () => {
    const { fauna, world } = createFauna();

    fauna.spawnHerd("deer", 0, 0, 1, createRandom(1));
    world.fields.fire.fill(0.8);
    runFor(fauna, 5);

    expect(fauna.animals.map((animal) => animal.causeOfDeath)).toEqual(["fire"]);
  });

  it("are born in spring", () => {
    const { fauna } = createFauna();

    const tick = tickOf({ days: 0.01, season: SPRING });

    fauna.spawnHerd("deer", 0, 0, 3, createRandom(1));

    for (let step = 0; step < 5000 && fauna.livingCount === 3; step += 1) {
      fauna.update(tick);
    }

    expect(fauna.livingCount).toBe(4);
    expect(fauna.animals.at(-1)?.youth).toBeGreaterThan(0.9);
  });

  it("are not born out of season", () => {
    const { fauna } = createFauna();

    fauna.spawnHerd("deer", 0, 0, 3, createRandom(1));
    runFor(fauna, 240, { days: 0.01, season: SUMMER });

    expect(fauna.livingCount).toBe(3);
  });
});

function spawned<Herd>(herd: Herd | null): Herd {
  if (herd === null) {
    throw new Error("Expected the herd to spawn");
  }

  return herd;
}

function slopedFauna() {
  return createFauna(
    createTestWorld({
      biome: Biome.Alpine,
      dimensions: { cellSize: 10, cellsPerSide: 96 },
      heightAt: (x) => 100 + x * 0.5,
    })
  );
}

describe("kinds of animals", () => {
  it("bring ibex to rocky heights when the world is populated", () => {
    const { fauna } = createFauna(
      createTestWorld({ biome: Biome.Alpine, dimensions: { cellSize: 10, cellsPerSide: 96 } })
    );

    expect(fauna.populate(3, createRandom(2))).toBe(3);
    expect(fauna.herds.every((herd) => herd.kind === "ibex")).toBe(true);
  });

  it("send a chased ibex bounding uphill while a deer runs straight away", () => {
    const danger: Waypoint = { x: 0, z: 40 };
    const threats: FaunaThreats = { dangerNear: () => danger, hunterNear: () => null };

    const climbers = slopedFauna();
    const runners = slopedFauna();

    climbers.fauna.spawnHerd("ibex", 0, 0, 1, createRandom(1));
    runners.fauna.spawnHerd("deer", 0, 0, 1, createRandom(1));

    const [ibex] = climbers.fauna.animals;
    const [deer] = runners.fauna.animals;

    const ibexStart = ibex.mover.x;
    const deerStart = deer.mover.x;

    runFor(climbers.fauna, 4, { threats });
    runFor(runners.fauna, 4, { threats });

    expect(ibex.mover.x - ibexStart).toBeGreaterThan(deer.mover.x - deerStart + 12);
    expect(ibex.mover.z).toBeLessThan(danger.z);
  });

  it("lead ibex herds to higher pastures", () => {
    const { fauna } = slopedFauna();

    const random = createRandom(1);

    const herds = [-160, -80, 0, 80, 160].map((z) => spawned(fauna.spawnHerd("ibex", -100, z, 2, random)));

    runFor(fauna, 1);

    expect(herds.every((herd) => herd.goalX > -60)).toBe(true);
  });

  it("let wolf packs roam much farther than deer herds", () => {
    const { fauna } = createFauna();

    const pack = spawned(fauna.spawnHerd("wolf", 0, 0, 3, createRandom(1)));

    runFor(fauna, 1);

    expect(Math.hypot(pack.goalX, pack.goalZ)).toBeGreaterThanOrEqual(ANIMALS.wolf.pastureRange[0]);
    expect(ANIMALS.wolf.pastureRange[0]).toBeGreaterThan(ANIMALS.deer.pastureRange[0]);
  });
});
