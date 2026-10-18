import { TooltipProvider } from "../design/tooltip.tsx";
import { useEngineStore } from "./engine-store.ts";
import { GameView } from "./game-view.tsx";
import { Hud } from "./hud.tsx";
import { useLaunchStore } from "./launch-store.ts";
import { LoadingScreen } from "./loading-screen.tsx";
import { useEngineBridges } from "./use-engine-bridges.ts";

function ReadyHud() {
  const isReady = useEngineStore((state) => state.status.kind === "ready");

  useEngineBridges();

  if (!isReady) {
    return null;
  }

  return <Hud />;
}

export function App() {
  const launch = useLaunchStore((state) => state.launch);

  return (
    <TooltipProvider>
      <main className="fixed inset-0 overflow-hidden bg-sky text-ink">
        <h1 className="sr-only">Dawnfolk</h1>

        <GameView launch={launch} />

        <ReadyHud />

        <LoadingScreen />
      </main>
    </TooltipProvider>
  );
}
