import { describe, expect, it, vi } from "vitest";
import type { TechnologyId } from "../content/technologies.ts";
import { ANIMAL_STRIDE, AnimalField, PERSON_STRIDE, PersonField } from "../world/agent-buffers.ts";
import { Simulation, TICK_SECONDS } from "./simulation.ts";
import { createVegetatedWorld } from "./testing/test-world.ts";

const WORLD_OPTIONS = { dimensions: { cellSize: 10, cellsPerSide: 96 } };
const ADVANCED: readonly TechnologyId[] = [
  "fire",
  "shelter",
  "spear",
  "storage",
  "archery",
  "huts",
  "pottery",
  "farming",
];

function createSimulation(): Simulation {
  const simulation = new Simulation(createVegetatedWorld(WORLD_OPTIONS));

  simulation.setViewFocus(0, 0);
  simulation.weather.setKind("clear");

  return simulation;
}

function advanceFor(simulation: Simulation, seconds: number): void {
  for (let elapsed = 0; elapsed < seconds; elapsed += 0.05) {
    simulation.advance(0.05);
  }
}

describe("time", () => {
  it("runs fixed ticks in proportion to the speed", () => {
    const normal = createSimulation();
    const fast = createSimulation();

    fast.execute({ speed: 4, type: "setSpeed" });
    advanceFor(normal, 2);
    advanceFor(fast, 2);

    expect(normal.tick).toBe(Math.round(2 / TICK_SECONDS));
    expect(fast.tick).toBe(normal.tick * 4);
  });

  it("stands still while paused", () => {
    const simulation = createSimulation();

    simulation.execute({ isPaused: true, type: "setPaused" });
    advanceFor(simulation, 1);

    expect(simulation.tick).toBe(0);
  });

  it("sets the time of day and the season", () => {
    const simulation = createSimulation();

    simulation.execute({ hours: 18, type: "setHours" });
    simulation.execute({ season: 3, type: "setSeason" });

    expect(simulation.calendar.hours).toBeCloseTo(18);
    expect(simulation.calendar.view().seasonName).toBe("Winter");
  });
});

describe("commands", () => {
  it("ignores and reports malformed commands", () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const simulation = createSimulation();

    simulation.execute({ speed: 900, type: "setSpeed" });
    simulation.execute({ type: "launchRocket" });

    expect(simulation.speed).toBe(1);
    expect(warning).toHaveBeenCalledTimes(2);
  });

  it("switches between chosen and automatic weather", () => {
    const simulation = createSimulation();

    simulation.execute({ type: "setWeather", weather: "storm" });

    expect(simulation.weather.state.kind).toBe("storm");
    expect(simulation.weather.state.isAutomatic).toBe(false);

    simulation.execute({ type: "setWeather", weather: "automatic" });

    expect(simulation.weather.state.isAutomatic).toBe(true);
  });

  it("validates and applies new world rules", () => {
    const simulation = createSimulation();

    simulation.execute({ rules: { fire: { spreadSpeed: 2 } }, type: "setWorldRules" });

    expect(simulation.rules.fire.spreadSpeed).toBe(2);
    expect(simulation.rules.water.drying).toBe(1);
  });
});

describe("powers", () => {
  it("lights a fire where the power is used", () => {
    const simulation = createSimulation();

    simulation.execute({ parameters: { radius: 20 }, powerId: "fire", type: "usePower", x: 0, z: 0 });

    expect(simulation.fire.burningCount).toBeGreaterThan(5);
  });

  it("keeps applying a brush while the stroke lasts", () => {
    const simulation = createSimulation();

    const cell = simulation.world.grid.cellAt(0, 0);

    simulation.execute({ parameters: { radius: 60 }, powerId: "raise", type: "beginStroke", x: 0, z: 0 });
    advanceFor(simulation, 1);

    const heightAfterOneSecond = simulation.world.terrain.height[cell];

    advanceFor(simulation, 1);
    simulation.execute({ type: "endStroke" });
    advanceFor(simulation, 1);

    expect(heightAfterOneSecond).toBeGreaterThan(110);
    expect(simulation.world.terrain.height[cell] - heightAfterOneSecond).toBeCloseTo(heightAfterOneSecond - 100, -1);
  });

  it("reports why a power could not be used", () => {
    const simulation = createSimulation();

    simulation.world.terrain.waterSurface.fill(200);
    simulation.execute({ parameters: {}, powerId: "tribe", type: "usePower", x: 0, z: 0 });

    expect(simulation.advance(0).notices).toEqual([expect.stringContaining("dry land")]);
  });

  it("drops a meteor after its fall time", () => {
    const simulation = createSimulation();

    simulation.execute({ parameters: { fallTime: 1 }, powerId: "meteor", type: "usePower", x: 0, z: 0 });

    const launch = simulation.advance(0.2);

    const later = Array.from({ length: 20 }, () => simulation.advance(0.05));

    const laterEffects = later.flatMap((frame) => frame.effects.map((effect) => effect.kind));

    expect(launch.effects.map((effect) => effect.kind)).toEqual(["meteor"]);
    expect(laterEffects).toContain("explosion");
    expect(simulation.world.terrain.height[simulation.world.grid.cellAt(0, 0)]).toBeLessThan(80);
  });
});

describe("frames", () => {
  it("pack every person into the people buffer", () => {
    const simulation = createSimulation();

    simulation.populate();

    const frame = simulation.advance(TICK_SECONDS);

    expect(frame.personCount).toBe(simulation.society.people.length);
    expect(frame.people).toHaveLength(frame.personCount * PERSON_STRIDE);
    expect(frame.people[PersonField.Id]).toBe(simulation.society.people[0].id);
    expect(frame.tribes.length).toBeGreaterThan(0);
  });

  it("pack every animal with its herd into the animal buffer", () => {
    const simulation = createSimulation();

    simulation.populate();

    const frame = simulation.advance(TICK_SECONDS);

    const { animals } = simulation.fauna;
    const last = frame.animalCount - 1;

    expect(frame.animalCount).toBeGreaterThan(0);
    expect(frame.animalCount).toBe(animals.length);
    expect(frame.animals).toHaveLength(frame.animalCount * ANIMAL_STRIDE);
    expect(frame.animals[last * ANIMAL_STRIDE + AnimalField.Id]).toBe(animals[last].id);
    expect(frame.animals[last * ANIMAL_STRIDE + AnimalField.HerdId]).toBe(animals[last].herdId);
  });

  it("send changed surface rows and height regions once", () => {
    const simulation = createSimulation();

    simulation.advance(0);
    simulation.execute({ parameters: { radius: 30 }, powerId: "raise", type: "usePower", x: 0, z: 0 });
    simulation.execute({ parameters: { radius: 20 }, powerId: "fire", type: "usePower", x: 200, z: 0 });

    const frame = simulation.advance(0);

    expect(frame.heightPatch).not.toBeNull();
    expect(frame.surfaceRows.length).toBeGreaterThan(0);
    expect(simulation.advance(0).heightPatch).toBeNull();
  });

  it("describe the current selection", () => {
    const simulation = createSimulation();

    simulation.populate();

    const [person] = simulation.society.people;

    simulation.execute({ selection: { id: person.id, kind: "person" }, type: "setSelection" });

    expect(simulation.advance(0).inspection).toMatchObject({ kind: "person", name: person.name });
  });

  it("reports recomputed water after the land settles", () => {
    const simulation = createSimulation();

    simulation.execute({ parameters: { radius: 80, strength: 100 }, powerId: "lower", type: "usePower", x: 0, z: 0 });

    const frames = Array.from({ length: 20 }, () => simulation.advance(0.1));

    expect(frames.some((frame) => frame.water !== null)).toBe(true);
  });
});

describe("determinism", () => {
  it("replays the same world the same way", () => {
    const first = createSimulation();
    const second = createSimulation();

    first.populate();
    second.populate();
    first.runTicks(300);
    second.runTicks(300);

    expect(first.advance(0).people).toEqual(second.advance(0).people);
  });

  it("replays the economy of advanced tribes the same way", () => {
    const runs = [createSimulation(), createSimulation()].map((simulation) => {
      simulation.populate();

      for (const tribe of simulation.society.tribes()) {
        for (const technology of ADVANCED) {
          tribe.technologies.add(technology);
        }

        tribe.stock.wood = 80;
        tribe.stock.stone = 40;
        tribe.stock.clay = 20;
      }

      simulation.runTicks(4000);

      return simulation.advance(0);
    });

    const [first, second] = runs;

    expect(first.people).toEqual(second.people);
    expect(first.tribes).toEqual(second.tribes);
    expect(first.buildings).toEqual(second.buildings);
    expect(first.buildings.length).toBeGreaterThan(2);
  });
});
