import type { BuildingKind } from "../content/buildings.ts";
import type { CropKind } from "../content/crops.ts";
import type { ResourceKind } from "../content/resources.ts";
import type { ToolMaterial } from "../content/weapons.ts";
import type { WeatherKind } from "../content/weather.ts";
import type { WorldRules } from "../content/world-rules.ts";
import type { CellRegion } from "../world/change-tracking.ts";
import type { Crossing } from "../world/crossings.ts";
import type { IslandShapeKind } from "../world/island-shape.ts";
import type { Monument } from "../world/monuments.ts";
import type { TerrainData } from "../world/terrain-data.ts";
import type { VegetationBuffers } from "../world/vegetation-store.ts";
import type { WaterFeatures } from "../world/water.ts";
import type { GridDimensions } from "../world/world-grid.ts";
import type { ChronicleEntry } from "./chronicle.ts";
import type { SimulationEffect } from "./effects.ts";
import type { Inspection } from "./inspection.ts";
import type { CalendarView } from "./nature/calendar.ts";
import type { RivalryView } from "./society/rivalry/rivalry-system.ts";

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
  crossings: readonly Crossing[];
  features: WaterFeatures;
  riverStrength: Uint8Array;
  waterSurface: Float32Array;
}

export interface BuildingView {
  extent: number;
  fuel: number;
  health: number;
  id: number;
  kind: BuildingKind;
  progress: number;
  rotation: number;
  seed: number;
  style: number;
  tribeId: number;
  variant: number;
  x: number;
  z: number;
}

export type StockView = Readonly<Record<ResourceKind, number>>;

export interface EraView {
  count: number;
  index: number;
  nextName: string | null;
}

export interface GoalView {
  isBlocked: boolean;
  need: string | null;
  progress: number;
  technologyName: string;
}

export interface BuildingCount {
  count: number;
  kind: BuildingKind;
  name: string;
}

export interface CropCount {
  count: number;
  crop: CropKind;
  name: string;
}

export interface FarmlandView {
  crops: CropCount[];
  fields: number;
  orchardTrees: number;
  woodlotTrees: number;
}

export interface TribeSummary {
  births: number;
  buildings: BuildingCount[];
  campX: number;
  campZ: number;
  children: number;
  color: string;
  deaths: number;
  era: EraView;
  eraName: string;
  faith: number;
  farmland: FarmlandView;
  furColor: string;
  goal: GoalView | null;
  id: number;
  isMigrating: boolean;
  name: string;
  population: number;
  stock: StockView;
  technologies: string[];
  tools: ToolMaterial;
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
  rivalry: RivalryView;
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

export type TerrainSnapshot = Omit<TerrainData, "carving" | "dryness" | "woodland">;

export interface InitialWorld {
  crossings: readonly Crossing[];
  dimensions: GridDimensions;
  frame: SimulationFrame;
  ground: Uint8Array;
  monuments: readonly Monument[];
  seed: number;
  shape: IslandShapeKind;
  surface: Uint8Array;
  terrain: TerrainSnapshot;
  vegetation: VegetationBuffers;
  water: WaterFeatures;
}
