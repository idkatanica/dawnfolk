import { useRef } from "react";
import type { LaunchOptions } from "./launch-options.ts";
import { useEngineLaunch } from "./use-engine-launch.ts";

interface GameViewProps {
  readonly launch: LaunchOptions;
}

export function GameView({ launch }: GameViewProps) {
  const containerReference = useRef<HTMLDivElement>(null);

  useEngineLaunch(containerReference, launch);

  return <div className="absolute inset-0" ref={containerReference} />;
}
