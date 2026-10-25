import { cn } from "../design/cn.ts";
import { useIsCompact } from "../design/use-media-query.ts";
import { CompactTopBar, PanelBar, StatusCard } from "../features/interface/top-bar.tsx";
import { JournalSheet } from "../features/journal/journal-sheet.tsx";
import { SidePanel } from "../features/journal/side-panel.tsx";
import { useIsSidePanelOpen } from "../features/journal/use-side-panel.ts";
import { WorldLabels } from "../features/labels/world-labels.tsx";
import { MinimapIsland } from "../features/minimap/minimap-island.tsx";
import { NoticeFeed } from "../features/notices/notice-feed.tsx";
import { PowerDock } from "../features/powers/power-dock.tsx";
import { PowerSettings } from "../features/powers/power-settings.tsx";
import { SettingsDialog } from "../features/settings/settings-dialog.tsx";
import { useEngineStore } from "./engine-store.ts";
import { useEngineBridges } from "./use-engine-bridges.ts";

const HUD_FRAME = "pointer-events-none fixed inset-0 z-10 flex flex-col p-safe";

function WideHud() {
  const isSidePanelOpen = useIsSidePanelOpen();

  return (
    <div className={cn(HUD_FRAME, "gap-3")}>
      <div className="flex min-h-0 flex-1 gap-3">
        <div className="flex min-w-0 flex-1 flex-col items-start gap-3">
          <StatusCard />

          <NoticeFeed className="items-start" />
        </div>

        <div className="flex min-h-0 flex-col items-end gap-3">
          <PanelBar />

          <SidePanel className="max-h-full min-h-0" />

          {isSidePanelOpen ? <PowerSettings className="mt-auto" /> : null}
        </div>
      </div>

      <div className="flex items-end gap-3">
        <div className="flex min-w-fit flex-1">
          <MinimapIsland />
        </div>

        <PowerDock className="min-w-0" />

        <div aria-hidden="true" className="flex-1" />
      </div>

      {isSidePanelOpen ? null : (
        <div className="pointer-events-none fixed inset-y-0 right-0 flex items-center p-safe">
          <PowerSettings />
        </div>
      )}
    </div>
  );
}

function CompactHud() {
  return (
    <div className={cn(HUD_FRAME, "gap-2")}>
      <CompactTopBar />

      <NoticeFeed />

      <div className="mt-auto flex min-h-0 flex-col gap-2">
        <MinimapIsland className="self-start" />

        <PowerSettings className="max-h-details" />

        <PowerDock />
      </div>

      <JournalSheet />
    </div>
  );
}

function Hud() {
  const isCompact = useIsCompact();

  return (
    <>
      <WorldLabels />

      {isCompact ? <CompactHud /> : <WideHud />}

      <SettingsDialog />
    </>
  );
}

export function ReadyHud() {
  const isReady = useEngineStore((state) => state.status.kind === "ready");

  useEngineBridges();

  if (!isReady) {
    return null;
  }

  return <Hud />;
}
