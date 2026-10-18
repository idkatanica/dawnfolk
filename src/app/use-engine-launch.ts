import { type RefObject, useEffect } from "react";
import { EngineLauncher } from "./engine-launcher.ts";
import { useEngineStore } from "./engine-store.ts";
import type { LaunchOptions } from "./launch-options.ts";

export function useEngineLaunch(containerReference: RefObject<HTMLDivElement | null>, launch: LaunchOptions): void {
  const setStatus = useEngineStore((state) => state.setStatus);

  useEffect(() => {
    const container = containerReference.current;

    if (container === null) {
      return;
    }

    const launcher = new EngineLauncher(container, launch, setStatus);

    return () => launcher.cancel();
  }, [containerReference, launch, setStatus]);
}
