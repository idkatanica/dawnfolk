import { transfer } from "comlink";
import type { GenerationProgress, WorldRequest } from "../generation/generation-options.ts";
import type { InitialWorld, SimulationFrame } from "../simulation/frame.ts";
import { Simulation } from "../simulation/simulation.ts";
import { VEGETATION_CHANNELS, type VegetationChannels } from "../world/vegetation-store.ts";

export interface SimulationWorkerApi {
  advance: (realSeconds: number, commands: readonly unknown[]) => SimulationFrame;
  createWorld: (request: WorldRequest, onProgress: (progress: GenerationProgress) => void) => InitialWorld;
}

type SimulationFactory = (request: WorldRequest, onProgress: (progress: GenerationProgress) => void) => Simulation;

function generateSimulation(request: WorldRequest, onProgress: (progress: GenerationProgress) => void): Simulation {
  const simulation = Simulation.generate(request.seed, request.options, onProgress);

  simulation.populate();

  return simulation;
}

function channelBuffers(vegetation: VegetationChannels): ArrayBufferLike[] {
  return VEGETATION_CHANNELS.map((channel) => vegetation[channel].buffer);
}

function frameTransferables(frame: SimulationFrame): ArrayBuffer[] {
  const buffers: ArrayBufferLike[] = [
    frame.people.buffer,
    frame.animals.buffer,
    frame.burningCells.buffer,
    frame.burningIntensity.buffer,
    ...frame.surfaceRows.map((rows) => rows.data.buffer),
    ...frame.groundRows.map((rows) => rows.data.buffer),
  ];

  if (frame.heightPatch !== null) {
    buffers.push(frame.heightPatch.values.buffer);
  }

  if (frame.water !== null) {
    buffers.push(frame.water.riverStrength.buffer, frame.water.waterSurface.buffer);
  }

  if (frame.waterLevels !== null) {
    buffers.push(frame.waterLevels.values.buffer);
  }

  if (frame.vegetation !== null) {
    buffers.push(...channelBuffers(frame.vegetation), frame.vegetation.indices.buffer);
  }

  return uniqueArrayBuffers(buffers);
}

function uniqueArrayBuffers(buffers: readonly ArrayBufferLike[]): ArrayBuffer[] {
  const unique = new Set(buffers.filter((buffer): buffer is ArrayBuffer => buffer instanceof ArrayBuffer));

  return [...unique];
}

function initialWorldTransferables(world: InitialWorld): ArrayBuffer[] {
  const { terrain, vegetation } = world;

  const buffers: ArrayBufferLike[] = [
    world.ground.buffer,
    world.surface.buffer,
    ...Object.values(terrain).map((values) => values.buffer),
    ...channelBuffers(vegetation),
  ];

  return uniqueArrayBuffers([...buffers, ...frameTransferables(world.frame)]);
}

export function createSimulationWorkerApi(
  createSimulation: SimulationFactory = generateSimulation
): SimulationWorkerApi {
  let simulation: Simulation | null = null;

  return {
    advance: (realSeconds, commands) => {
      if (simulation === null) {
        throw new Error("The world has not been created yet");
      }

      for (const command of commands) {
        simulation.execute(command);
      }

      const frame = simulation.advance(realSeconds);

      return transfer(frame, frameTransferables(frame));
    },
    createWorld: (request, onProgress) => {
      simulation = createSimulation(request, onProgress);

      const world = simulation.initialWorld();

      return transfer(world, initialWorldTransferables(world));
    },
  };
}
