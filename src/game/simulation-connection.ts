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

class CommandQueue {
  #commands: SimulationCommand[] = [];

  push(command: SimulationCommand): void {
    this.#commands.push(command);
  }

  take(): SimulationCommand[] {
    const commands = this.#commands;

    this.#commands = [];

    return commands;
  }
}

function settle<Value>(run: () => Value): Promise<Value> {
  return new Promise((resolve) => {
    resolve(run());
  });
}

export class WorkerSimulationConnection implements SimulationConnection {
  readonly #queue = new CommandQueue();
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
    return this.#remote.advance(realSeconds, this.#queue.take());
  }

  createWorld(request: WorldRequest, onProgress: (progress: GenerationProgress) => void): Promise<InitialWorld> {
    this.#queue.take();

    return this.#remote.createWorld(request, proxy(onProgress));
  }

  dispose(): void {
    this.#worker.terminate();
  }

  send(command: SimulationCommand): void {
    this.#queue.push(command);
  }
}

export class LocalSimulationConnection implements SimulationConnection {
  readonly #api: SimulationWorkerApi;
  readonly #queue = new CommandQueue();

  constructor(api: SimulationWorkerApi) {
    this.#api = api;
  }

  advance(realSeconds: number): Promise<SimulationFrame> {
    return settle(() => this.#api.advance(realSeconds, this.#queue.take()));
  }

  createWorld(request: WorldRequest, onProgress: (progress: GenerationProgress) => void): Promise<InitialWorld> {
    this.#queue.take();

    return settle(() => this.#api.createWorld(request, onProgress));
  }

  dispose(): void {
    this.#queue.take();
  }

  send(command: SimulationCommand): void {
    this.#queue.push(command);
  }
}
