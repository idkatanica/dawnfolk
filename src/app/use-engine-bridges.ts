import { useEffect } from "react";
import { connectGuide } from "../features/guide/connect-guide.ts";
import { connectPowers } from "../features/powers/connect-powers.ts";
import { connectAutosave } from "../features/saves/saves-store.ts";
import { connectWorldStore } from "../features/world/world-store.ts";
import { rememberWorldInAddress, useLaunchStore } from "./launch-store.ts";
import { useEngine } from "./use-engine.ts";

export function useEngineBridges(): void {
  const engine = useEngine();
  const worldId = useLaunchStore((state) => state.worldId);
  const name = useLaunchStore((state) => state.launch.name);

  useEffect(() => {
    if (engine === null) {
      return;
    }

    const disconnectWorld = connectWorldStore(engine.session);
    const disconnectPowers = connectPowers(engine);
    const disconnectGuide = connectGuide(engine.session);

    return () => {
      disconnectWorld();
      disconnectPowers();
      disconnectGuide();
    };
  }, [engine]);

  useEffect(() => {
    if (engine === null) {
      return;
    }

    rememberWorldInAddress(worldId);

    return connectAutosave(engine.session, { id: worldId, name });
  }, [engine, name, worldId]);
}
