import type { EngineHandle } from "../game/engine-handle.ts";
import type { GameEngine } from "../game/game-engine.ts";
import type { GenerationProgress } from "../generation/world-generator.ts";
import { DEFAULT_WORLD_REQUEST } from "../workers/simulation-worker-api.ts";
import { exposeEngineForDebugging } from "./debug-handle.ts";
import type { LaunchOptions } from "./launch-options.ts";

export type EngineStatus =
  | { readonly engine: EngineHandle; readonly kind: "ready" }
  | { readonly kind: "failed"; readonly message: string }
  | { readonly kind: "loading"; readonly progress: GenerationProgress | null };

export type EngineStatusListener = (status: EngineStatus) => void;

function describeFailure(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function createCanvas(container: HTMLElement): HTMLCanvasElement {
  const canvas = document.createElement("canvas");

  canvas.className = "block size-full touch-none select-none outline-none";
  canvas.tabIndex = 0;
  canvas.setAttribute("aria-label", "The island");
  container.append(canvas);

  return canvas;
}

export class EngineLauncher {
  readonly #canvas: HTMLCanvasElement;
  readonly #onStatus: EngineStatusListener;
  #engine: GameEngine | null = null;
  #state: "cancelled" | "running" | "starting" = "starting";

  constructor(container: HTMLElement, launch: LaunchOptions, onStatus: EngineStatusListener) {
    this.#canvas = createCanvas(container);
    this.#onStatus = onStatus;
    this.#onStatus({ kind: "loading", progress: null });
    queueMicrotask(() => this.#startUnlessCancelled(launch));
  }

  cancel(): void {
    this.#state = "cancelled";

    if (this.#engine !== null) {
      this.#engine.dispose();
      this.#engine = null;
    }

    this.#canvas.remove();
  }

  #startUnlessCancelled(launch: LaunchOptions): void {
    if (this.#state === "cancelled") {
      return;
    }

    this.#start(launch).catch((error: unknown) => this.#fail(error));
  }

  async #start(launch: LaunchOptions): Promise<void> {
    const engineModule = await import("../game/game-engine.ts");

    const engine = await engineModule.GameEngine.start({
      camera: launch.camera,
      canvas: this.#canvas,
      onProgress: (progress) => this.#progress(progress),
      quality: launch.quality,
      request: { ...DEFAULT_WORLD_REQUEST, seed: launch.seed },
    });

    if (this.#state === "cancelled") {
      engine.dispose();

      return;
    }

    this.#state = "running";
    this.#engine = engine;
    this.#applyLaunchTime(engine, launch);
    exposeEngineForDebugging(engine);
    this.#onStatus({ engine, kind: "ready" });
  }

  #applyLaunchTime(engine: GameEngine, launch: LaunchOptions): void {
    if (launch.hours !== null) {
      engine.session.send({ hours: launch.hours, type: "setHours" });
    }

    if (launch.isPaused) {
      engine.session.send({ isPaused: true, type: "setPaused" });
    }
  }

  #progress(progress: GenerationProgress): void {
    if (this.#state !== "starting") {
      return;
    }

    this.#onStatus({ kind: "loading", progress });
  }

  #fail(error: unknown): void {
    console.error("Dawnfolk could not start", error);

    if (this.#state === "cancelled") {
      return;
    }

    this.#onStatus({ kind: "failed", message: describeFailure(error) });
  }
}
