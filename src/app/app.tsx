import { lazy, Suspense, useEffect } from "react";
import { TooltipProvider } from "../design/tooltip.tsx";
import { GameView } from "./game-view.tsx";
import { useLaunchStore } from "./launch-store.ts";
import { LoadingScreen } from "./loading-screen.tsx";
import { StartScreen } from "./start-screen.tsx";

const ReadyHud = lazy(() => import("./hud.tsx").then((module) => ({ default: module.ReadyHud })));

function GameScreen() {
  const launch = useLaunchStore((state) => state.launch);

  useEffect(() => {
    document.title = `${launch.name} · Dawnfolk`;
  }, [launch.name]);

  return (
    <>
      <GameView launch={launch} />

      <Suspense fallback={null}>
        <ReadyHud />
      </Suspense>

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
