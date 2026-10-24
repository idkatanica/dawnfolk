import type { GenerationProgress, WorldRequest } from "../generation/generation-options.ts";
import type { ChronicleEntry } from "../simulation/chronicle.ts";
import type { SimulationCommand } from "../simulation/commands.ts";
import type { SimulationEffect } from "../simulation/effects.ts";
import type { SimulationFrame } from "../simulation/frame.ts";
import type { SimulationConnection } from "./simulation-connection.ts";
import { WorldMirror } from "./world-mirror.ts";

export const CHRONICLE_HISTORY_LIMIT = 300;

const TICK_SECONDS = 0.1;
const LONGEST_QUIET_SECONDS = 1;

export type SessionStatus = { kind: "closed" } | { error: Error; kind: "failed" } | { kind: "running" };

type FrameListener = (frame: SimulationFrame) => void;

type StatusListener = (status: SessionStatus) => void;

interface SessionClock {
  now: () => number;
}

interface SessionOptions {
  clock?: SessionClock;
  onProgress?: (progress: GenerationProgress) => void;
}

const PERFORMANCE_CLOCK: SessionClock = { now: () => performance.now() };

function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(String(error));
}

export class GameSession {
  readonly mirror: WorldMirror;
  readonly #chronicle: ChronicleEntry[] = [];
  readonly #clock: SessionClock;
  readonly #connection: SimulationConnection;
  readonly #effects: SimulationEffect[] = [];
  readonly #frameListeners = new Set<FrameListener>();
  readonly #statusListeners = new Set<StatusListener>();
  #commandsSinceRequest = 0;
  #pendingSeconds = 0;
  #request: Promise<void> | null = null;
  #status: SessionStatus = { kind: "running" };

  constructor(connection: SimulationConnection, mirror: WorldMirror, clock: SessionClock) {
    this.#connection = connection;
    this.#clock = clock;
    this.mirror = mirror;
    this.#remember(mirror.frame);
  }

  static async create(
    connection: SimulationConnection,
    request: WorldRequest,
    options: SessionOptions = {}
  ): Promise<GameSession> {
    const { clock = PERFORMANCE_CLOCK, onProgress = () => undefined } = options;

    const initial = await connection.createWorld(request, onProgress);

    return new GameSession(connection, new WorldMirror(initial, clock.now()), clock);
  }

  get chronicle(): readonly ChronicleEntry[] {
    return this.#chronicle;
  }

  get frame(): SimulationFrame {
    return this.mirror.frame;
  }

  get status(): SessionStatus {
    return this.#status;
  }

  send(command: SimulationCommand): void {
    if (this.#status.kind !== "running") {
      return;
    }

    this.#connection.send(command);
    this.#commandsSinceRequest += 1;
  }

  update(realSeconds: number): void {
    if (this.#status.kind !== "running") {
      return;
    }

    this.#pendingSeconds += realSeconds;

    if (this.#request !== null || !this.#isAdvanceDue()) {
      return;
    }

    const seconds = this.#pendingSeconds;

    this.#pendingSeconds = 0;
    this.#commandsSinceRequest = 0;
    this.#request = this.#advance(seconds);
  }

  whenIdle(): Promise<void> {
    if (this.#request === null) {
      return Promise.resolve();
    }

    return this.#request;
  }

  takeEffects(): SimulationEffect[] {
    return this.#effects.splice(0);
  }

  subscribe(listener: FrameListener): () => void {
    this.#frameListeners.add(listener);

    return () => {
      this.#frameListeners.delete(listener);
    };
  }

  subscribeToStatus(listener: StatusListener): () => void {
    this.#statusListeners.add(listener);

    return () => {
      this.#statusListeners.delete(listener);
    };
  }

  close(): void {
    if (this.#status.kind === "closed") {
      return;
    }

    this.#setStatus({ kind: "closed" });
    this.#frameListeners.clear();
    this.#statusListeners.clear();
    this.#connection.dispose();
  }

  #isAdvanceDue(): boolean {
    const { frame } = this.mirror;

    const hasCommands = this.#commandsSinceRequest > 0;
    const isQuietTooLong = this.#pendingSeconds >= LONGEST_QUIET_SECONDS;

    if (hasCommands || frame.isBusy || isQuietTooLong) {
      return true;
    }

    if (frame.isPaused) {
      return false;
    }

    return frame.secondsSinceTick + this.#pendingSeconds * frame.speed >= TICK_SECONDS;
  }

  async #advance(seconds: number): Promise<void> {
    try {
      const frame = await this.#connection.advance(seconds);

      this.#receive(frame);
    } catch (error) {
      this.#fail(toError(error));
    } finally {
      this.#request = null;
    }
  }

  #receive(frame: SimulationFrame): void {
    if (this.#status.kind !== "running") {
      return;
    }

    this.mirror.apply(frame, this.#clock.now());
    this.#remember(frame);

    for (const listener of this.#frameListeners) {
      listener(frame);
    }
  }

  #remember(frame: SimulationFrame): void {
    this.#chronicle.push(...frame.chronicle);
    this.#effects.push(...frame.effects);

    const excess = this.#chronicle.length - CHRONICLE_HISTORY_LIMIT;

    if (excess > 0) {
      this.#chronicle.splice(0, excess);
    }
  }

  #fail(error: Error): void {
    console.error("The simulation stopped", error);
    this.#setStatus({ error, kind: "failed" });
  }

  #setStatus(status: SessionStatus): void {
    this.#status = status;

    for (const listener of this.#statusListeners) {
      listener(status);
    }
  }
}
