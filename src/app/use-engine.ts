import type { EngineHandle } from "../game/engine-handle.ts";
import type { SimulationCommand } from "../simulation/commands.ts";
import { useEngineStore } from "./engine-store.ts";

export function useEngine(): EngineHandle | null {
  return useEngineStore((state) => (state.status.kind === "ready" ? state.status.engine : null));
}

export function useSendCommand(): (command: SimulationCommand) => void {
  const engine = useEngine();

  return (command) => {
    if (engine !== null) {
      engine.session.send(command);
    }
  };
}
