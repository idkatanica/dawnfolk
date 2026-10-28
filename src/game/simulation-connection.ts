import { proxy, type Remote, transfer, wrap } from "comlink";
import type { GenerationProgress, WorldRequest } from "../generation/generation-options.ts";
import { buffersWithin } from "../shared/buffers.ts";
import type { SimulationCommand } from "../simulation/commands.ts";
import type { InitialWorld, SimulationFrame } from "../simulation/frame.ts";
import type { SavedWorldState } from "../simulation/saved-world.ts";
import type { SimulationWorkerApi } from "../workers/simulation-worker-api.ts";

export interface SimulationConnection {
  advance: (realSeconds: number) => Promise<SimulationFrame>;
  createWorld: (request: WorldRequest, onProgress: (progress: GenerationProgress) => void) => Promise<InitialWorld>;
  dispose: () => void;
  loadWorld: (saved: SavedWorldState, onProgress: (progress: GenerationProgress) => void) => Promise<InitialWorld>;
  saveWorld: () => Promise<SavedWorldState | null>;
  send: (command: SimulationCommand) => void;
}

function settle<Value>(run: () => Value): Promise<Value> {
  return new Promise((resolve) => {
    resolve(run());
  });
}

function failureOf(worker: Worker): Promise<never> {
  const failure = new Promise<never>((_resolve, reject) => {
    worker.addEventListener(
      "error",
      (event) => {
        reject(new Error(event instanceof ErrorEvent ? event.message : "The simulation worker could not load"));
      },
      { once: true }
    );
  });

  failure.catch(() => undefined);

  return failure;
}

export class WorkerSimulationConnection implements SimulationConnection {
  readonly #commands: SimulationCommand[] = [];
  readonly #failure: Promise<never>;
  readonly #remote: Remote<SimulationWorkerApi>;
  readonly #worker: Worker;

  constructor() {
    this.#worker = new Worker(new URL("../workers/simulation-worker.ts", import.meta.url), {
      name: "simulation",
      type: "module",
    });
    this.#remote = wrap<SimulationWorkerApi>(this.#worker);
    this.#failure = failureOf(this.#worker);
  }

  advance(realSeconds: number): Promise<SimulationFrame> {
    return Promise.race([this.#remote.advance(realSeconds, this.#commands.splice(0)), this.#failure]);
  }

  createWorld(request: WorldRequest, onProgress: (progress: GenerationProgress) => void): Promise<InitialWorld> {
    this.#commands.splice(0);

    return Promise.race([this.#remote.createWorld(request, proxy(onProgress)), this.#failure]);
  }

  loadWorld(saved: SavedWorldState, onProgress: (progress: GenerationProgress) => void): Promise<InitialWorld> {
    this.#commands.splice(0);

    const sent = transfer(saved, buffersWithin(saved));

    return Promise.race([this.#remote.loadWorld(sent, proxy(onProgress)), this.#failure]);
  }

  saveWorld(): Promise<SavedWorldState | null> {
    return Promise.race([this.#remote.saveWorld(), this.#failure]);
  }

  dispose(): void {
    this.#worker.terminate();
  }

  send(command: SimulationCommand): void {
    this.#commands.push(command);
  }
}

export class LocalSimulationConnection implements SimulationConnection {
  readonly #api: SimulationWorkerApi;
  readonly #commands: SimulationCommand[] = [];

  constructor(api: SimulationWorkerApi) {
    this.#api = api;
  }

  advance(realSeconds: number): Promise<SimulationFrame> {
    return settle(() => this.#api.advance(realSeconds, this.#commands.splice(0)));
  }

  createWorld(request: WorldRequest, onProgress: (progress: GenerationProgress) => void): Promise<InitialWorld> {
    this.#commands.splice(0);

    return settle(() => this.#api.createWorld(request, onProgress));
  }

  loadWorld(saved: SavedWorldState, onProgress: (progress: GenerationProgress) => void): Promise<InitialWorld> {
    this.#commands.splice(0);

    return settle(() => this.#api.loadWorld(saved, onProgress));
  }

  saveWorld(): Promise<SavedWorldState | null> {
    return settle(() => this.#api.saveWorld());
  }

  dispose(): void {
    this.#commands.splice(0);
  }

  send(command: SimulationCommand): void {
    this.#commands.push(command);
  }
}
