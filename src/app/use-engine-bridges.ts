import { useEffect } from "react";
import { useInspectorStore } from "../features/inspector/inspector-store.ts";
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

    useInspectorStore.getState().setFollowing(false);

    return () => {
      disconnectWorld();
      disconnectPowers();
    };
  }, [engine]);
}
