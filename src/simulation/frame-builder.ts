import type { HeightPatch, InitialWorld, PackedRows, SimulationFrame, SimulationStatistics } from "./frame.ts";
import {
  allRows,
  describeBuilding,
  describeTribe,
  describeWeather,
  packAnimals,
  packBurningCells,
  packChangedSurfaceRows,
  packGroundRows,
  packHeightPatch,
  packPeople,
  packSurfaceRows,
  packVegetationChanges,
} from "./frame-packing.ts";
import { type Inspection, inspect } from "./inspection.ts";
import type { Simulation } from "./simulation.ts";

export class FrameBuilder {
  readonly #simulation: Simulation;
  #sentSurface: Uint8Array | null = null;

  constructor(simulation: Simulation) {
    this.#simulation = simulation;
  }

  build(): SimulationFrame {
    const simulation = this.#simulation;
    const { buildings, fauna, fire, society, world } = simulation;

    const burningCells = Int32Array.from(fire.burningCells());

    return {
      animalCount: fauna.animals.length,
      animals: packAnimals(fauna.animals),
      buildings: buildings.all.map((building) => describeBuilding(building)),
      burningCells,
      burningIntensity: packBurningCells(world, burningCells),
      calendar: simulation.calendar.view(),
      chronicle: simulation.chronicle.takeEntries(),
      effects: simulation.effects.takeEffects(),
      groundRows: packGroundRows(world, world.groundChanges.takeRuns()),
      heightPatch: this.#heightPatch(),
      inspection: this.#inspection(),
      isBusy: simulation.isBusy,
      isPaused: simulation.isPaused,
      notices: simulation.takeNotices(),
      people: packPeople(society.people),
      personCount: society.people.length,
      rules: simulation.rules,
      secondsSinceTick: simulation.secondsSinceTick,
      speed: simulation.speed,
      statistics: this.#statistics(),
      surfaceRows: this.#changedSurfaceRows(),
      tick: simulation.tick,
      tribes: society.tribes().map((tribe) => describeTribe(tribe, society.membersOf(tribe))),
      vegetation: packVegetationChanges(world.vegetation.takeChanges()),
      water: simulation.takeWaterUpdate(),
      weather: describeWeather(simulation.weather, simulation.environment),
    };
  }

  #changedSurfaceRows(): PackedRows[] {
    const { world } = this.#simulation;

    const runs = world.surfaceChanges.takeRuns();

    if (this.#sentSurface === null) {
      return packSurfaceRows(world, runs);
    }

    return packChangedSurfaceRows(world, runs, this.#sentSurface);
  }

  initialWorld(): InitialWorld {
    const { world } = this.#simulation;
    const { terrain } = world;

    world.surfaceChanges.takeRuns();
    world.groundChanges.takeRuns();
    world.heightChanges.takeRegion();
    world.vegetation.discardChanges();

    const [surface] = packSurfaceRows(world, allRows(world));
    const [ground] = packGroundRows(world, allRows(world));

    this.#sentSurface = surface.data.slice();

    return {
      dimensions: { cellSize: world.grid.cellSize, cellsPerSide: world.grid.cellsPerSide },
      frame: this.build(),
      ground: ground.data,
      seed: world.seed,
      surface: surface.data,
      terrain: {
        baseTemperature: Float32Array.from(terrain.baseTemperature),
        biome: Uint8Array.from(terrain.biome),
        ground: Uint8Array.from(terrain.ground),
        height: Float32Array.from(terrain.height),
        moisture: Float32Array.from(terrain.moisture),
        riverStrength: Uint8Array.from(terrain.riverStrength),
        variation: Float32Array.from(terrain.variation),
        waterSurface: Float32Array.from(terrain.waterSurface),
      },
      vegetation: world.vegetation.exportBuffers(),
      water: world.water,
    };
  }

  #heightPatch(): HeightPatch | null {
    const { world } = this.#simulation;

    const region = world.heightChanges.takeRegion();

    if (region === null) {
      return null;
    }

    return packHeightPatch(world, region);
  }

  #inspection(): Inspection | null {
    const simulation = this.#simulation;
    const { selection } = simulation;

    if (selection === null) {
      return null;
    }

    return inspect(selection, {
      buildings: simulation.buildings,
      environment: simulation.environment,
      fauna: simulation.fauna,
      society: simulation.society,
      world: simulation.world,
    });
  }

  #statistics(): SimulationStatistics {
    const { buildings, fauna, fire, society, world } = this.#simulation;

    return {
      animals: fauna.livingCount,
      buildings: buildings.all.length,
      burningCells: fire.burningCount,
      deaths: society.deaths,
      plants: world.vegetation.aliveCount,
      population: society.population,
      tribes: society.tribes().length,
    };
  }
}
