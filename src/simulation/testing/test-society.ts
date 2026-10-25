import { DEFAULT_WORLD_RULES, type WorldRules } from "../../content/world-rules.ts";
import { createRandom, type RandomSource } from "../../shared/random.ts";
import { HazardMap } from "../agents/hazards.ts";
import { NavigationGrid } from "../agents/navigation.ts";
import { Chronicle } from "../chronicle.ts";
import { EffectLog } from "../effects.ts";
import { FaunaSystem } from "../fauna/fauna.ts";
import { IdentifierSource } from "../identifiers.ts";
import { Calendar } from "../nature/calendar.ts";
import { describeEnvironment } from "../nature/environment.ts";
import { FireSystem } from "../nature/fire.ts";
import { WeatherSystem } from "../nature/weather.ts";
import { BuildingSystem } from "../society/buildings.ts";
import type { Person } from "../society/person.ts";
import { RivalrySystem } from "../society/rivalry/rivalry-system.ts";
import { SocietySystem } from "../society/society.ts";
import type { PersonTick, SocietyContext } from "../society/society-context.ts";
import type { Tribe } from "../society/tribe.ts";
import { TICK_SECONDS } from "../tick.ts";
import { WorldState } from "../world/world-state.ts";
import { createVegetatedWorld, type TestWorldOptions } from "./test-world.ts";

const SEED = 3;

interface SocietyHarnessOptions {
  day: number;
  isFaunaAwake: boolean;
  rules: WorldRules;
  world: Partial<TestWorldOptions>;
}

export class SocietyHarness {
  readonly buildings: BuildingSystem;
  readonly calendar = new Calendar();
  readonly chronicle = new Chronicle();
  readonly context: SocietyContext;
  readonly effects = new EffectLog();
  readonly fauna: FaunaSystem;
  readonly fire: FireSystem;
  readonly hazards: HazardMap;
  readonly identifiers = new IdentifierSource();
  readonly isFaunaAwake: boolean;
  readonly navigation: NavigationGrid;
  readonly random: RandomSource;
  readonly rivalry: RivalrySystem;
  readonly society: SocietySystem;
  readonly weather = new WeatherSystem();
  readonly world: WorldState;

  constructor(options: Partial<SocietyHarnessOptions> = {}) {
    const settings: SocietyHarnessOptions = {
      day: 0.36,
      isFaunaAwake: false,
      rules: DEFAULT_WORLD_RULES,
      world: { dimensions: { cellSize: 10, cellsPerSide: 96 } },
      ...options,
    };

    this.isFaunaAwake = settings.isFaunaAwake;
    this.world = new WorldState(createVegetatedWorld(settings.world, SEED));
    this.calendar.day = settings.day;
    this.random = createRandom(SEED);
    this.navigation = new NavigationGrid(this.world);
    this.fire = new FireSystem(this.world);
    this.hazards = new HazardMap(this.world, this.fire);
    this.fauna = new FaunaSystem(this.world, this.navigation, this.identifiers);
    this.buildings = new BuildingSystem(this.world, this.identifiers);
    this.society = new SocietySystem({
      buildings: this.buildings,
      chronicle: this.chronicle,
      identifiers: this.identifiers,
    });
    this.rivalry = new RivalrySystem({ chronicle: this.chronicle, effects: this.effects, seed: SEED });
    this.weather.setKind("clear");
    this.context = {
      buildings: this.buildings,
      chronicle: this.chronicle,
      effects: this.effects,
      environment: describeEnvironment(this.calendar, this.weather),
      fauna: this.fauna,
      fire: this.fire,
      hazards: this.hazards,
      identifiers: this.identifiers,
      navigation: this.navigation,
      people: this.society,
      random: this.random,
      rivalry: this.rivalry,
      rules: settings.rules,
      world: this.world,
    };
  }

  run(seconds: number): void {
    for (let elapsed = 0; elapsed < seconds; elapsed += TICK_SECONDS) {
      this.step();
    }
  }

  step(): void {
    const days = this.calendar.advance(TICK_SECONDS);

    this.context.environment = describeEnvironment(this.calendar, this.weather);
    this.chronicle.day = this.calendar.day;
    this.fire.update(
      TICK_SECONDS,
      { airTemperatureOffset: 0, day: this.calendar.day, drought: 0.5 },
      this.context.rules,
      this.random
    );
    this.buildings.update({
      days,
      fire: this.fire,
      random: this.random,
      seconds: TICK_SECONDS,
      weather: { drought: 0.5, precipitation: 0, windSpeed: 10 },
    });
    this.society.update(TICK_SECONDS, days, this.context);
    this.rivalry.update(TICK_SECONDS, days, this.context);
    this.#wakeFauna(days);
    this.hazards.update(TICK_SECONDS);
  }

  #wakeFauna(days: number): void {
    if (!this.isFaunaAwake) {
      return;
    }

    this.fauna.update({
      days,
      hours: this.calendar.hours,
      random: this.random,
      rules: this.context.rules,
      season: this.calendar.season,
      seconds: TICK_SECONDS,
      threats: {
        dangerNear: (x, z, radius) => this.hazards.dangerNear(x, z, radius),
        hunterNear: () => null,
        people: this.rivalry.senses(this.context),
      },
    });
  }

  spawnTribe(people: number): Tribe | null {
    return this.society.spawnTribe({ context: this.context, people, technologies: [], x: 0, z: 0 });
  }
}

export function settle(harness: SocietyHarness, people: number): Tribe {
  const tribe = harness.spawnTribe(people);

  if (tribe === null) {
    throw new Error("Expected the tribe to settle");
  }

  return tribe;
}

export function tickFor(harness: SocietyHarness, person: Person, tribe: Tribe): PersonTick {
  return { context: harness.context, person, seconds: TICK_SECONDS, tribe };
}

export function firstMemberTick(harness: SocietyHarness, tribe: Tribe): PersonTick {
  const [person] = harness.society.membersOf(tribe);

  return tickFor(harness, person, tribe);
}
