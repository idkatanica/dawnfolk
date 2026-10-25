import { useEffect, useRef } from "react";
import { EngineLauncher } from "./engine-launcher.ts";
import { useEngineStore } from "./engine-store.ts";
import type { LaunchOptions } from "./launch-options.ts";

interface GameViewProps {
  readonly launch: LaunchOptions;
}

export function GameView({ launch }: GameViewProps) {
  const containerReference = useRef<HTMLDivElement>(null);
  const setStatus = useEngineStore((state) => state.setStatus);

  useEffect(() => {
    const container = containerReference.current;

    if (container === null) {
      return;
    }

    const launcher = new EngineLauncher(container, launch, setStatus);

    return () => launcher.cancel();
  }, [launch, setStatus]);

  return <div className="absolute inset-0" ref={containerReference} />;
}
