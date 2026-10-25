import type { EngineHandle } from "../game/engine-handle.ts";
import type { GameEngine } from "../game/game-engine.ts";
import type { GameSession } from "../game/game-session.ts";
import { DEFAULT_GENERATION_OPTIONS, type GenerationProgress } from "../generation/generation-options.ts";
import { toError } from "../shared/errors.ts";
import type { LaunchOptions } from "./launch-options.ts";

export type EngineStatus =
  | { readonly engine: EngineHandle; readonly kind: "ready" }
  | { readonly kind: "failed"; readonly message: string }
  | { readonly kind: "loading"; readonly progress: GenerationProgress | null }
  | { readonly kind: "stopped"; readonly message: string };

type EngineStatusListener = (status: EngineStatus) => void;

export function loadGameEngine() {
  return import("../game/game-engine.ts");
}

export function loadHud() {
  return import("./hud.tsx");
}

export function reportStop(session: GameSession, onStatus: EngineStatusListener): void {
  session.subscribeToStatus((status) => {
    if (status.kind === "failed") {
      onStatus({ kind: "stopped", message: status.error.message });
    }
  });
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
    const [engineModule] = await Promise.all([loadGameEngine(), loadHud()]);

    const engine = await engineModule.GameEngine.start({
      camera: launch.camera,
      canvas: this.#canvas,
      onProgress: (progress) => this.#progress(progress),
      quality: launch.quality,
      request: { options: { ...DEFAULT_GENERATION_OPTIONS, shape: launch.shape }, seed: launch.seed },
    });

    if (this.#state === "cancelled") {
      engine.dispose();

      return;
    }

    this.#state = "running";
    this.#engine = engine;
    this.#applyLaunchTime(engine, launch);

    if (import.meta.env.DEV) {
      Reflect.set(window, "dawnfolk", engine);
    }

    reportStop(engine.session, (status) => {
      engine.stop();
      this.#onStatus(status);
    });
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

    this.#onStatus({ kind: "failed", message: toError(error).message });
  }
}
