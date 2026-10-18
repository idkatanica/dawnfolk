import { DEFAULT_WORLD_RULES } from "../../content/world-rules.ts";
import type { ChronicleEntry } from "../../simulation/chronicle.ts";
import type { SimulationFrame, SimulationStatistics, TribeSummary, WeatherView } from "../../simulation/frame.ts";
import type {
  AnimalInspection,
  BuildingInspection,
  CellInspection,
  PersonInspection,
} from "../../simulation/inspection.ts";
import type { CalendarView } from "../../simulation/nature/calendar.ts";
import { useWorldStore, type WorldSnapshot } from "../world/world-store.ts";

export function createCalendar(overrides: Partial<CalendarView> = {}): CalendarView {
  return {
    day: 0.42,
    dayOfSeason: 1,
    daySeconds: 240,
    daysPerSeason: 3,
    hours: 10,
    isTimeFrozen: false,
    season: 0,
    seasonName: "Spring",
    year: 1,
    ...overrides,
  };
}

export function createWeather(overrides: Partial<WeatherView> = {}): WeatherView {
  return {
    airTemperatureOffset: 0,
    cloudCover: 0.1,
    fog: 0,
    isAutomatic: true,
    kind: "clear",
    name: "Clear",
    precipitation: 0,
    storm: 0,
    userTemperatureOffset: 0,
    windBaseSpeed: 14,
    windDirection: 90,
    windSpeed: 14,
    windX: 1,
    windZ: 0,
    ...overrides,
  };
}

export function createStatistics(overrides: Partial<SimulationStatistics> = {}): SimulationStatistics {
  return {
    animals: 30,
    buildings: 4,
    burningCells: 0,
    deaths: 0,
    plants: 12_000,
    population: 14,
    tribes: 2,
    ...overrides,
  };
}

export function createTribe(overrides: Partial<TribeSummary> = {}): TribeSummary {
  return {
    births: 2,
    campX: -851,
    campZ: 616,
    children: 3,
    color: "#c8553d",
    deaths: 1,
    eraName: "Wanderers",
    faith: 40,
    foundedDay: 0,
    furColor: "#7a5638",
    id: 1,
    isMigrating: false,
    knowledge: 30,
    name: "Bear Clan",
    nextTechnology: { cost: 60, name: "Fire making" },
    population: 7,
    stock: { food: 12.4, stone: 3, wood: 8.6 },
    technologies: ["Gathering"],
    ...overrides,
  };
}

export function createPersonInspection(overrides: Partial<PersonInspection> = {}): PersonInspection {
  return {
    activity: "Resting",
    age: 26,
    energy: 0.9,
    health: 1,
    hunger: 0.24,
    id: 4,
    isAlive: true,
    isChild: false,
    isFemale: false,
    kind: "person",
    name: "Esk",
    tribeName: "Bear Clan",
    warmth: 1,
    x: -849,
    z: 613,
    ...overrides,
  };
}

export function createAnimalInspection(overrides: Partial<AnimalInspection> = {}): AnimalInspection {
  return {
    activity: "Grazing",
    health: 0.8,
    id: 9,
    isAlive: true,
    isYoung: false,
    kind: "animal",
    name: "Deer",
    x: 120,
    z: -40,
    ...overrides,
  };
}

export function createBuildingInspection(overrides: Partial<BuildingInspection> = {}): BuildingInspection {
  return {
    fuel: 0.6,
    health: 1,
    id: 2,
    isBurning: false,
    kind: "building",
    name: "Campfire",
    progress: 1,
    tribeName: "Bear Clan",
    x: -851,
    z: 616,
    ...overrides,
  };
}

export function createCellInspection(overrides: Partial<CellInspection> = {}): CellInspection {
  return {
    biomeName: "Broadleaf forest",
    fire: 0,
    groundName: "Grass",
    height: 212.4,
    kind: "cell",
    plants: [{ isBurnt: false, name: "Oak" }],
    scorch: 0,
    snow: 0,
    temperature: 14.2,
    waterDepth: 0,
    wetness: 0.3,
    x: -120.4,
    z: 340.7,
    ...overrides,
  };
}

export function createChronicleEntry(overrides: Partial<ChronicleEntry> = {}): ChronicleEntry {
  return {
    category: "arrival",
    day: 0.4,
    id: 1,
    text: "The Bear Clan arrives on the island.",
    tribeId: 1,
    x: -851,
    z: 616,
    ...overrides,
  };
}

export function createSnapshot(overrides: Partial<WorldSnapshot> = {}): WorldSnapshot {
  return {
    calendar: createCalendar(),
    inspection: null,
    isPaused: false,
    rules: DEFAULT_WORLD_RULES,
    speed: 1,
    statistics: createStatistics(),
    tribes: [createTribe(), createTribe({ color: "#3f7cc4", id: 2, name: "Wolf Clan" })],
    weather: createWeather(),
    ...overrides,
  };
}

export function createFrame(overrides: Partial<SimulationFrame> = {}): SimulationFrame {
  return {
    animalCount: 0,
    animals: new Float32Array(0),
    buildings: [],
    burningCells: new Int32Array(0),
    burningIntensity: new Uint8Array(0),
    calendar: createCalendar(),
    chronicle: [],
    effects: [],
    groundRows: [],
    heightPatch: null,
    inspection: null,
    isPaused: false,
    notices: [],
    people: new Float32Array(0),
    personCount: 0,
    rules: DEFAULT_WORLD_RULES,
    secondsSinceTick: 0,
    speed: 1,
    statistics: createStatistics(),
    surfaceRows: [],
    tick: 0,
    tribes: [createTribe()],
    vegetation: null,
    water: null,
    weather: createWeather(),
    ...overrides,
  };
}

export function showWorld(overrides: Partial<WorldSnapshot> = {}): WorldSnapshot {
  const snapshot = createSnapshot(overrides);

  useWorldStore.setState({ snapshot });

  return snapshot;
}

export function resetWorld(): void {
  useWorldStore.setState({ chronicle: [], notices: [], seed: 0, snapshot: null });
}
