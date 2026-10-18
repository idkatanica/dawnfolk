import type { BuildingKind } from "../content/buildings.ts";
import type { WeatherKind } from "../content/weather.ts";
import type { WorldRules } from "../content/world-rules.ts";
import type { CellRegion } from "../world/change-tracking.ts";
import type { TerrainData } from "../world/terrain-data.ts";
import type { VegetationBuffers } from "../world/vegetation-store.ts";
import type { WaterFeatures } from "../world/water.ts";
import type { GridDimensions } from "../world/world-grid.ts";
import type { ChronicleEntry } from "./chronicle.ts";
import type { SimulationEffect } from "./effects.ts";
import type { Inspection } from "./inspection.ts";
import type { CalendarView } from "./nature/calendar.ts";

export interface PackedRows {
  data: Uint8Array;
  firstRow: number;
  rowCount: number;
}

export interface HeightPatch {
  heights: Float32Array;
  region: CellRegion;
}

export interface VegetationPatch {
  bornDay: Float32Array;
  count: number;
  fruit: Float32Array;
  height: Float32Array;
  indices: Int32Array;
  rotation: Float32Array;
  seed: Float32Array;
  species: Uint8Array;
  state: Uint8Array;
  x: Float32Array;
  z: Float32Array;
}

export interface WaterUpdate {
  features: WaterFeatures;
  riverStrength: Uint8Array;
  waterSurface: Float32Array;
}

export interface BuildingView {
  fuel: number;
  health: number;
  id: number;
  isBurning: boolean;
  kind: BuildingKind;
  progress: number;
  rotation: number;
  seed: number;
  tribeId: number;
  x: number;
  z: number;
}

interface StockView {
  food: number;
  stone: number;
  wood: number;
}

export interface TechnologyProgress {
  cost: number;
  name: string;
}

export interface TribeSummary {
  births: number;
  campX: number;
  campZ: number;
  children: number;
  color: string;
  deaths: number;
  eraName: string;
  faith: number;
  foundedDay: number;
  furColor: string;
  id: number;
  isMigrating: boolean;
  knowledge: number;
  name: string;
  nextTechnology: TechnologyProgress | null;
  population: number;
  stock: StockView;
  technologies: string[];
}

export interface WeatherView {
  airTemperatureOffset: number;
  cloudCover: number;
  fog: number;
  isAutomatic: boolean;
  kind: WeatherKind;
  name: string;
  precipitation: number;
  storm: number;
  userTemperatureOffset: number;
  windBaseSpeed: number;
  windDirection: number;
  windSpeed: number;
  windX: number;
  windZ: number;
}

export interface SimulationStatistics {
  animals: number;
  buildings: number;
  burningCells: number;
  deaths: number;
  plants: number;
  population: number;
  tribes: number;
}

export interface SimulationFrame {
  animalCount: number;
  animals: Float32Array;
  buildings: BuildingView[];
  burningCells: Int32Array;
  burningIntensity: Uint8Array;
  calendar: CalendarView;
  chronicle: ChronicleEntry[];
  effects: SimulationEffect[];
  groundRows: PackedRows[];
  heightPatch: HeightPatch | null;
  inspection: Inspection | null;
  isBusy: boolean;
  isPaused: boolean;
  notices: string[];
  people: Float32Array;
  personCount: number;
  rules: WorldRules;
  secondsSinceTick: number;
  speed: number;
  statistics: SimulationStatistics;
  surfaceRows: PackedRows[];
  tick: number;
  tribes: TribeSummary[];
  vegetation: VegetationPatch | null;
  water: WaterUpdate | null;
  weather: WeatherView;
}

export type TerrainSnapshot = Omit<TerrainData, "carving" | "dryness">;

export interface InitialWorld {
  dimensions: GridDimensions;
  frame: SimulationFrame;
  ground: Uint8Array;
  seed: number;
  surface: Uint8Array;
  terrain: TerrainSnapshot;
  vegetation: VegetationBuffers;
  water: WaterFeatures;
}
