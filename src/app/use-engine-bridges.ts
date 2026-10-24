import { useEffect } from "react";
import { connectPowers } from "../features/powers/connect-powers.ts";
import { connectWorldStore } from "../features/world/world-store.ts";
import { useEngine } from "./use-engine.ts";

export function useEngineBridges(): void {
  const engine = useEngine();

  useEffect(() => {
    if (engine === null) {
      return;
    }

    const disconnectWorld = connectWorldStore(engine.session);
    const disconnectPowers = connectPowers(engine);

    return () => {
      disconnectWorld();
      disconnectPowers();
    };
  }, [engine]);
}
