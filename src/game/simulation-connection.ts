import { proxy, type Remote, wrap } from "comlink";
import type { GenerationProgress, WorldRequest } from "../generation/generation-options.ts";
import type { SimulationCommand } from "../simulation/commands.ts";
import type { InitialWorld, SimulationFrame } from "../simulation/frame.ts";
import type { SimulationWorkerApi } from "../workers/simulation-worker-api.ts";

export interface SimulationConnection {
  advance: (realSeconds: number) => Promise<SimulationFrame>;
  createWorld: (request: WorldRequest, onProgress: (progress: GenerationProgress) => void) => Promise<InitialWorld>;
  dispose: () => void;
  send: (command: SimulationCommand) => void;
}

function settle<Value>(run: () => Value): Promise<Value> {
  return new Promise((resolve) => {
    resolve(run());
  });
}

export class WorkerSimulationConnection implements SimulationConnection {
  readonly #commands: SimulationCommand[] = [];
  readonly #remote: Remote<SimulationWorkerApi>;
  readonly #worker: Worker;

  constructor() {
    this.#worker = new Worker(new URL("../workers/simulation-worker.ts", import.meta.url), {
      name: "simulation",
      type: "module",
    });
    this.#remote = wrap<SimulationWorkerApi>(this.#worker);
  }

  advance(realSeconds: number): Promise<SimulationFrame> {
    return this.#remote.advance(realSeconds, this.#commands.splice(0));
  }

  createWorld(request: WorldRequest, onProgress: (progress: GenerationProgress) => void): Promise<InitialWorld> {
    this.#commands.splice(0);

    return this.#remote.createWorld(request, proxy(onProgress));
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

  dispose(): void {
    this.#commands.splice(0);
  }

  send(command: SimulationCommand): void {
    this.#commands.push(command);
  }
}
