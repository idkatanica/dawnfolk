import type { GameEngine } from "../game/game-engine.ts";

export function exposeEngineForDebugging(engine: GameEngine): void {
  if (!import.meta.env.DEV) {
    return;
  }

  Reflect.set(window, "dawnfolk", engine);
}
