import { lazy, Suspense, useEffect } from "react";
import { TooltipProvider } from "../design/tooltip.tsx";
import { loadHud } from "./engine-launcher.ts";
import { useEngineStore } from "./engine-store.ts";
import { GameView } from "./game-view.tsx";
import { useLaunchStore } from "./launch-store.ts";
import { LoadingScreen } from "./loading-screen.tsx";
import { StartScreen } from "./start-screen.tsx";

const ReadyHud = lazy(() => loadHud().then((module) => ({ default: module.ReadyHud })));

function GameScreen() {
  const launch = useLaunchStore((state) => state.launch);
  const isReady = useEngineStore((state) => state.status.kind === "ready");

  useEffect(() => {
    document.title = `${launch.name} · Dawnfolk`;
  }, [launch.name]);

  return (
    <>
      <GameView launch={launch} />

      {isReady ? (
        <Suspense fallback={null}>
          <ReadyHud />
        </Suspense>
      ) : null}

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
