import { DEFAULT_WORLD_RULES, type WorldRules } from "../../content/world-rules.ts";
import { createRandom, type RandomSource } from "../../shared/random.ts";
import { HazardMap } from "../agents/hazards.ts";
import { NavigationGrid } from "../agents/navigation.ts";
import { Chronicle } from "../chronicle.ts";
import { FaunaSystem } from "../fauna/fauna.ts";
import { IdentifierSource } from "../identifiers.ts";
import { Calendar, DEFAULT_CALENDAR } from "../nature/calendar.ts";
import { describeEnvironment } from "../nature/environment.ts";
import { FireSystem } from "../nature/fire.ts";
import { WeatherSystem } from "../nature/weather.ts";
import { BuildingSystem } from "../society/buildings.ts";
import type { Person } from "../society/person.ts";
import { SocietySystem } from "../society/society.ts";
import type { PersonTick, SocietyContext } from "../society/society-context.ts";
import type { Tribe } from "../society/tribe.ts";
import { WorldState } from "../world/world-state.ts";
import { createVegetatedWorld, type TestWorldOptions } from "./test-world.ts";

const TICK_SECONDS = 0.1;
const SEED = 3;

interface SocietyHarnessOptions {
  day: number;
  rules: WorldRules;
  world: Partial<TestWorldOptions>;
}

export class SocietyHarness {
  readonly buildings: BuildingSystem;
  readonly calendar: Calendar;
  readonly chronicle = new Chronicle();
  readonly context: SocietyContext;
  readonly fauna: FaunaSystem;
  readonly fire: FireSystem;
  readonly hazards: HazardMap;
  readonly identifiers = new IdentifierSource();
  readonly navigation: NavigationGrid;
  readonly random: RandomSource;
  readonly society: SocietySystem;
  readonly weather = new WeatherSystem();
  readonly world: WorldState;

  constructor(options: Partial<SocietyHarnessOptions> = {}) {
    const settings: SocietyHarnessOptions = {
      day: 0.36,
      rules: DEFAULT_WORLD_RULES,
      world: { dimensions: { cellSize: 10, cellsPerSide: 96 } },
      ...options,
    };

    this.world = new WorldState(createVegetatedWorld(settings.world, SEED));
    this.calendar = new Calendar({ ...DEFAULT_CALENDAR, day: settings.day });
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
    this.weather.setKind("clear");
    this.context = {
      buildings: this.buildings,
      chronicle: this.chronicle,
      environment: describeEnvironment(this.calendar, this.weather),
      fauna: this.fauna,
      fire: this.fire,
      hazards: this.hazards,
      identifiers: this.identifiers,
      navigation: this.navigation,
      people: this.society,
      random: this.random,
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
    this.hazards.update(TICK_SECONDS);
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
