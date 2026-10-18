import type { PowerId } from "../content/powers.ts";
import type { WeatherKind } from "../content/weather.ts";
import { DEFAULT_WORLD_RULES, readWorldRules, type WorldRules } from "../content/world-rules.ts";
import {
  type GeneratedWorld,
  type GenerationOptions,
  type GenerationProgress,
  generateWorld,
} from "../generation/world-generator.ts";
import { clamp } from "../shared/math.ts";
import { createRandom, type RandomSource } from "../shared/random.ts";
import { HazardMap } from "./agents/hazards.ts";
import { NavigationGrid, type Waypoint } from "./agents/navigation.ts";
import { Chronicle } from "./chronicle.ts";
import { type CommandOf, readCommand, type Selection, type SimulationCommandType } from "./commands.ts";
import { EffectLog } from "./effects.ts";
import { FaunaSystem, type FaunaThreats } from "./fauna/fauna.ts";
import type { InitialWorld, SimulationFrame, WaterUpdate } from "./frame.ts";
import { FrameBuilder } from "./frame-builder.ts";
import { IdentifierSource } from "./identifiers.ts";
import { Calendar } from "./nature/calendar.ts";
import { type Ember, EmberSystem } from "./nature/embers.ts";
import { describeEnvironment, type Environment } from "./nature/environment.ts";
import { FireSystem } from "./nature/fire.ts";
import { SurfaceSystem } from "./nature/surface.ts";
import { VegetationGrowthSystem } from "./nature/vegetation-growth.ts";
import { WeatherSystem } from "./nature/weather.ts";
import { naturalStrikeSite, strikeLightning } from "./powers/catastrophes.ts";
import { type PowerOutcome, type PowerServices, percent } from "./powers/power-handler.ts";
import { applyPower, parsePowerParameters } from "./powers/power-registry.ts";
import { type BuildingIncidentKind, BuildingSystem } from "./society/buildings.ts";
import { SocietySystem } from "./society/society.ts";
import type { Tribe } from "./society/tribe.ts";
import { drowningText, drownMonuments } from "./world/monument-damage.ts";
import { WaterRecomputation } from "./world/water-recomputation.ts";
import { WorldState } from "./world/world-state.ts";

export const TICK_SECONDS = 0.1;

const MAXIMUM_REAL_SECONDS = 0.25;
const MAXIMUM_TICKS_PER_ADVANCE = 40;
const NAVIGATION_CHECK_TICKS = 50;
const FIRST_STROKE_SECONDS = 1 / 30;
const STARTING_HERDS = 16;
const STARTING_TRIBES = 2;
const STARTING_TRIBE_SIZE = 7;
const STARTING_SPOTS: readonly Waypoint[] = [
  { x: -0.35, z: 0.25 },
  { x: -0.6, z: 0.6 },
  { x: 0.25, z: -0.2 },
];
const HUNTER_NOTICE_DISTANCE = 18;
const GLOWING_EMBER_INTENSITY = 0.35;
const COOLING_EMBER_HEAT = 0.22;

interface BrushStroke {
  parameters: Readonly<Record<string, unknown>>;
  powerId: PowerId;
  startHeight: number;
  x: number;
  z: number;
}

interface ScheduledTask {
  remainingSeconds: number;
  run: () => void;
}

type CommandHandlers = {
  readonly [Type in SimulationCommandType]: (simulation: Simulation, command: CommandOf<Type>) => void;
};

const COMMAND_HANDLERS: CommandHandlers = {
  beginStroke: (simulation, command) =>
    simulation.beginStroke(command.powerId, command.x, command.z, command.parameters),
  endStroke: (simulation) => simulation.endStroke(),
  moveStroke: (simulation, command) => simulation.moveStroke(command.x, command.z),
  setDaySeconds: (simulation, command) => {
    simulation.calendar.daySeconds = command.seconds;
  },
  setDaysPerSeason: (simulation, command) => simulation.calendar.setDaysPerSeason(command.days),
  setHours: (simulation, command) => simulation.calendar.setHours(command.hours),
  setPaused: (simulation, command) => simulation.setPaused(command.isPaused),
  setSeason: (simulation, command) => simulation.calendar.setSeason(command.season),
  setSelection: (simulation, command) => simulation.setSelection(command.selection),
  setSpeed: (simulation, command) => simulation.setSpeed(command.speed),
  setTemperatureOffset: (simulation, command) => simulation.weather.setUserTemperatureOffset(command.offset),
  setTimeFrozen: (simulation, command) => {
    simulation.calendar.isTimeFrozen = command.isFrozen;
  },
  setViewFocus: (simulation, command) => simulation.setViewFocus(command.x, command.z),
  setWeather: (simulation, command) => simulation.setWeather(command.weather),
  setWind: (simulation, command) => simulation.weather.setWind(command.direction, command.speed),
  setWorldRules: (simulation, command) => simulation.setRules(readWorldRules(command.rules)),
  usePower: (simulation, command) => simulation.usePower(command.powerId, command.x, command.z, command.parameters),
};

function runCommand<Type extends SimulationCommandType>(
  simulation: Simulation,
  type: Type,
  command: CommandOf<Type>
): void {
  const handler: CommandHandlers[Type] = COMMAND_HANDLERS[type];

  handler(simulation, command);
}

function incidentMessage(kind: BuildingIncidentKind, tribe: Tribe | null): string {
  const tribeName = tribe === null ? "A tribe" : tribe.name;

  if (kind === "caughtFire") {
    return `A building of ${tribeName} caught fire`;
  }

  return `The campfire of ${tribeName} spread to the grass`;
}

export class Simulation {
  readonly buildings: BuildingSystem;
  readonly calendar = new Calendar();
  readonly chronicle = new Chronicle();
  readonly effects = new EffectLog();
  readonly embers: EmberSystem;
  readonly fauna: FaunaSystem;
  readonly fire: FireSystem;
  readonly hazards: HazardMap;
  readonly identifiers = new IdentifierSource();
  readonly navigation: NavigationGrid;
  readonly random: RandomSource;
  readonly services: PowerServices;
  readonly society: SocietySystem;
  readonly surface: SurfaceSystem;
  readonly vegetationGrowth: VegetationGrowthSystem;
  readonly waterRecomputation: WaterRecomputation;
  readonly weather = new WeatherSystem();
  readonly world: WorldState;
  readonly #frames: FrameBuilder;
  #isPaused: boolean;
  #notices: string[] = [];
  #selection: Selection | null = null;
  #speed = 1;
  #stroke: BrushStroke | null = null;
  #tasks: ScheduledTask[] = [];
  #tick = 0;
  #tickBacklog = 0;
  #viewFocus: Waypoint = { x: 0, z: 0 };
  #waterUpdate: WaterUpdate | null = null;

  constructor(generated: GeneratedWorld) {
    this.world = new WorldState(generated);
    this.random = createRandom(generated.seed * 5 + 17);
    this.navigation = new NavigationGrid(this.world);
    this.fire = new FireSystem(this.world);
    this.hazards = new HazardMap(this.world, this.fire);
    this.embers = new EmberSystem(this.world);
    this.surface = new SurfaceSystem(this.world);
    this.vegetationGrowth = new VegetationGrowthSystem(this.world);
    this.waterRecomputation = new WaterRecomputation(this.world);
    this.fauna = new FaunaSystem(this.world, this.navigation, this.identifiers);
    this.buildings = new BuildingSystem(this.world, this.identifiers);
    this.society = new SocietySystem({
      buildings: this.buildings,
      chronicle: this.chronicle,
      identifiers: this.identifiers,
    });
    this.services = this.#createServices();
    this.#frames = new FrameBuilder(this);
    this.#isPaused = false;
  }

  static generate(
    seed: number,
    options: GenerationOptions,
    onProgress: (progress: GenerationProgress) => void
  ): Simulation {
    return new Simulation(generateWorld(seed, options, onProgress));
  }

  get environment(): Environment {
    return this.services.environment;
  }

  get isBusy(): boolean {
    return this.#tasks.length > 0 || this.#stroke !== null || this.waterRecomputation.isPending;
  }

  get isPaused(): boolean {
    return this.#isPaused;
  }

  get rules(): WorldRules {
    return this.services.rules;
  }

  get secondsSinceTick(): number {
    return this.#tickBacklog;
  }

  get selection(): Selection | null {
    return this.#selection;
  }

  get speed(): number {
    return this.#speed;
  }

  get tick(): number {
    return this.#tick;
  }

  populate(): void {
    const { halfSize } = this.world.grid;

    let settled = 0;

    for (const spot of STARTING_SPOTS) {
      if (settled >= STARTING_TRIBES) {
        break;
      }

      if (this.#spawnTribe(spot.x * halfSize, spot.z * halfSize)) {
        settled += 1;
      }
    }

    if (settled === 0) {
      this.#spawnTribe(0, 0);
    }

    this.fauna.populate(STARTING_HERDS, this.random);
    this.chronicle.takeEntries();
  }

  execute(command: unknown): void {
    const parsed = readCommand(command);

    if (parsed === null) {
      return;
    }

    runCommand(this, parsed.type, parsed);
  }

  usePower(powerId: PowerId, x: number, z: number, values: unknown): void {
    const parameters = parsePowerParameters(powerId, values);

    if (parameters === null) {
      return;
    }

    const target = { seconds: 0, strokeStartHeight: this.world.surfaceAt(x, z), x, z };

    this.#recordOutcome(applyPower(powerId, parameters, target, this.services));
  }

  beginStroke(powerId: PowerId, x: number, z: number, parameters: Readonly<Record<string, unknown>>): void {
    this.#stroke = { parameters, powerId, startHeight: this.world.heightAt(x, z), x, z };
    this.#applyStroke(FIRST_STROKE_SECONDS);
  }

  moveStroke(x: number, z: number): void {
    if (this.#stroke === null) {
      return;
    }

    this.#stroke.x = x;
    this.#stroke.z = z;
  }

  endStroke(): void {
    this.#stroke = null;
  }

  setPaused(isPaused: boolean): void {
    this.#isPaused = isPaused;
  }

  setSpeed(speed: number): void {
    this.#speed = speed;
  }

  setRules(rules: WorldRules): void {
    this.services.rules = rules;
  }

  setSelection(selection: Selection | null): void {
    this.#selection = selection;
  }

  setViewFocus(x: number, z: number): void {
    this.#viewFocus = { x, z };
  }

  setWeather(weather: WeatherKind | "automatic"): void {
    if (weather === "automatic") {
      this.weather.setAutomatic();

      return;
    }

    this.weather.setKind(weather);
  }

  schedule(delaySeconds: number, run: () => void): void {
    this.#tasks.push({ remainingSeconds: delaySeconds, run });
  }

  takeNotices(): string[] {
    const notices = this.#notices;

    this.#notices = [];

    return notices;
  }

  takeWaterUpdate(): WaterUpdate | null {
    const update = this.#waterUpdate;

    this.#waterUpdate = null;

    return update;
  }

  advance(realSeconds: number): SimulationFrame {
    const seconds = clamp(realSeconds, 0, MAXIMUM_REAL_SECONDS);

    this.#applyStroke(seconds);
    this.#runTasks(seconds);
    this.#recomputeWaterWhenSettled(seconds);
    this.#tickBacklog += this.#gameSeconds(seconds);

    let ticks = 0;

    while (this.#tickBacklog >= TICK_SECONDS && ticks < MAXIMUM_TICKS_PER_ADVANCE) {
      this.step();
      this.#tickBacklog -= TICK_SECONDS;
      ticks += 1;
    }

    this.#tickBacklog = Math.min(this.#tickBacklog, TICK_SECONDS);

    return this.#frames.build();
  }

  runTicks(count: number): void {
    for (let tick = 0; tick < count; tick += 1) {
      this.step();
    }
  }

  step(): void {
    const days = this.calendar.advance(TICK_SECONDS);

    this.chronicle.day = this.calendar.day;
    this.#updateWeather(days);

    const environment = describeEnvironment(this.calendar, this.weather);

    this.services.environment = environment;
    this.#updateNature(days, environment);
    this.#updateLife(days, environment);
    this.#tick += 1;

    if (this.#tick % NAVIGATION_CHECK_TICKS === 0) {
      this.navigation.rebuildIfChanged();
    }
  }

  initialWorld(): InitialWorld {
    return this.#frames.initialWorld();
  }

  #gameSeconds(realSeconds: number): number {
    if (this.#isPaused) {
      return 0;
    }

    return realSeconds * this.#speed;
  }

  #createServices(): PowerServices {
    return {
      buildings: this.buildings,
      chronicle: this.chronicle,
      effects: this.effects,
      embers: this.embers,
      environment: describeEnvironment(this.calendar, this.weather),
      fauna: this.fauna,
      fire: this.fire,
      hazards: this.hazards,
      identifiers: this.identifiers,
      navigation: this.navigation,
      people: this.society,
      random: this.random,
      rules: DEFAULT_WORLD_RULES,
      schedule: (delaySeconds, run) => this.schedule(delaySeconds, run),
      society: this.society,
      world: this.world,
    };
  }

  #spawnTribe(x: number, z: number): boolean {
    const tribe = this.society.spawnTribe({
      context: this.services,
      people: STARTING_TRIBE_SIZE,
      technologies: [],
      x,
      z,
    });

    return tribe !== null;
  }

  #recordOutcome(outcome: PowerOutcome): void {
    if (outcome.kind === "refused") {
      this.#notices.push(outcome.reason);
    }
  }

  #applyStroke(seconds: number): void {
    const stroke = this.#stroke;

    if (stroke === null || seconds <= 0) {
      return;
    }

    const parameters = parsePowerParameters(stroke.powerId, stroke.parameters);

    if (parameters === null) {
      this.#stroke = null;

      return;
    }

    const target = { seconds, strokeStartHeight: stroke.startHeight, x: stroke.x, z: stroke.z };

    this.#recordOutcome(applyPower(stroke.powerId, parameters, target, this.services));
  }

  #runTasks(seconds: number): void {
    const due: ScheduledTask[] = [];

    for (const task of this.#tasks) {
      task.remainingSeconds -= seconds;

      if (task.remainingSeconds <= 0) {
        due.push(task);
      }
    }

    this.#tasks = this.#tasks.filter((task) => task.remainingSeconds > 0);

    for (const task of due) {
      task.run();
    }
  }

  #recomputeWaterWhenSettled(seconds: number): void {
    if (!this.waterRecomputation.update(seconds)) {
      return;
    }

    this.navigation.rebuild();
    this.#waterUpdate = {
      features: this.world.water,
      riverStrength: Uint8Array.from(this.world.terrain.riverStrength),
      waterSurface: Float32Array.from(this.world.terrain.waterSurface),
    };
    this.#settleNewWater();
  }

  #settleNewWater(): void {
    for (const building of [...this.buildings.all]) {
      if (building.cell >= 0 && this.world.isWater(building.cell)) {
        this.buildings.remove(building, "destroyed");
      }
    }

    for (const monument of drownMonuments(this.world)) {
      this.chronicle.record({
        category: "warning",
        text: drowningText(monument),
        tribeId: null,
        x: monument.x,
        z: monument.z,
      });
    }
  }

  #updateWeather(days: number): void {
    const update = this.weather.update(
      { day: this.calendar.day, elapsedDays: days, elapsedSeconds: TICK_SECONDS, season: this.calendar.season },
      this.services.rules,
      this.random
    );

    if (update.changedTo !== null) {
      this.chronicle.record({
        category: "weather",
        text: `The weather turned: ${this.weather.name.toLowerCase()}`,
        tribeId: null,
        x: this.#viewFocus.x,
        z: this.#viewFocus.z,
      });
    }

    for (let strike = 0; strike < update.lightningStrikes; strike += 1) {
      this.#strikeNaturalLightning();
    }
  }

  #strikeNaturalLightning(): void {
    const site = naturalStrikeSite(this.#viewFocus, this.services);

    if (site === null) {
      return;
    }

    const ignitionChance = percent(this.services.rules.storms.lightningIgnition);

    strikeLightning({ ignitionChance, isNatural: true, x: site.x, z: site.z }, this.services);
  }

  #updateNature(days: number, environment: Environment): void {
    const { rules } = this.services;

    this.fire.setWind(environment.windX, environment.windZ, environment.windSpeed, rules);

    for (const cell of this.fire.update(TICK_SECONDS, environment, rules, this.random)) {
      this.#launchEmber(cell, environment);
    }

    this.embers.update(TICK_SECONDS, (ember) => this.#landEmber(ember));
    this.surface.update(TICK_SECONDS, days, environment, rules);
    this.vegetationGrowth.update(days, environment, rules, this.random);
  }

  #launchEmber(cell: number, environment: Environment): void {
    const wind = { strength: this.fire.windStrength, x: environment.windX, z: environment.windZ };

    const ember = this.embers.launch(cell, wind, this.random);

    this.effects.add({
      durationSeconds: ember.durationSeconds,
      fromX: ember.fromX,
      fromZ: ember.fromZ,
      kind: "ember",
      toX: ember.toX,
      toZ: ember.toZ,
    });
  }

  #landEmber(ember: Ember): void {
    const cell = this.world.grid.cellAt(ember.toX, ember.toZ);

    if (ember.isGlowing) {
      this.fire.ignite(cell, GLOWING_EMBER_INTENSITY);

      return;
    }

    this.fire.addHeat(cell, COOLING_EMBER_HEAT);
  }

  #updateLife(days: number, environment: Environment): void {
    const { rules } = this.services;

    this.buildings.update({
      days,
      fire: this.fire,
      random: this.random,
      seconds: TICK_SECONDS,
      weather: environment,
    });
    this.society.update(TICK_SECONDS, days, this.services);
    this.fauna.update({
      days,
      random: this.random,
      rules,
      season: environment.season,
      seconds: TICK_SECONDS,
      threats: this.#faunaThreats(),
    });
    this.hazards.update(TICK_SECONDS);
    this.#recordBuildingIncidents();
  }

  #faunaThreats(): FaunaThreats {
    return {
      dangerNear: (x, z, radius) => this.hazards.dangerNear(x, z, radius),
      hunterNear: (x, z, radius) => {
        const hunter = this.society.nearestPerson(x, z, radius, (person) => {
          const isStalking = person.job?.kind === "hunt";

          return !isStalking || Math.hypot(person.mover.x - x, person.mover.z - z) < HUNTER_NOTICE_DISTANCE;
        });

        if (hunter === null) {
          return null;
        }

        return { x: hunter.mover.x, z: hunter.mover.z };
      },
    };
  }

  #recordBuildingIncidents(): void {
    for (const incident of this.buildings.takeIncidents()) {
      const tribe = this.society.findTribe(incident.building.tribeId);

      this.chronicle.record({
        category: "fire",
        text: incidentMessage(incident.kind, tribe),
        tribeId: incident.building.tribeId,
        x: incident.building.x,
        z: incident.building.z,
      });
    }
  }
}
