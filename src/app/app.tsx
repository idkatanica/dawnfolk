import { useEffect } from "react";
import { TooltipProvider } from "../design/tooltip.tsx";
import { useEngineStore } from "./engine-store.ts";
import { GameView } from "./game-view.tsx";
import { Hud } from "./hud.tsx";
import { useLaunchStore } from "./launch-store.ts";
import { LoadingScreen } from "./loading-screen.tsx";
import { StartScreen } from "./start-screen.tsx";
import { useEngineBridges } from "./use-engine-bridges.ts";

function ReadyHud() {
  const isReady = useEngineStore((state) => state.status.kind === "ready");

  useEngineBridges();

  if (!isReady) {
    return null;
  }

  return <Hud />;
}

function GameScreen() {
  const launch = useLaunchStore((state) => state.launch);

  useEffect(() => {
    document.title = `${launch.name} · Dawnfolk`;
  }, [launch.name]);

  return (
    <>
      <GameView launch={launch} />

      <ReadyHud />

      <LoadingScreen />
    </>
  );
}

export function App() {
  const isChoosingWorld = useLaunchStore((state) => state.isChoosingWorld);

  return (
    <TooltipProvider>
      <main className="fixed inset-0 overflow-hidden">
        <h1 className="sr-only">Dawnfolk</h1>

        {isChoosingWorld ? <StartScreen /> : <GameScreen />}
      </main>
    </TooltipProvider>
  );
}
