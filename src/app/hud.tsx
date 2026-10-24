import { cn } from "../design/cn.ts";
import { useIsCompact } from "../design/use-media-query.ts";
import { InspectorIsland } from "../features/inspector/inspector-island.tsx";
import { CompactTopBar, TopBar } from "../features/interface/top-bar.tsx";
import { JournalIsland } from "../features/journal/journal-island.tsx";
import { JournalSheet } from "../features/journal/journal-sheet.tsx";
import { WorldLabels } from "../features/labels/world-labels.tsx";
import { MinimapIsland } from "../features/minimap/minimap-island.tsx";
import { NoticeFeed } from "../features/notices/notice-feed.tsx";
import { PowerDock } from "../features/powers/power-dock.tsx";
import { PowerSettings } from "../features/powers/power-settings.tsx";
import { usePowerStore } from "../features/powers/power-store.ts";
import { SettingsDialog } from "../features/settings/settings-dialog.tsx";

const HUD_FRAME = "pointer-events-none fixed inset-0 z-10 flex flex-col p-safe";

function WideHud() {
  return (
    <div className={cn(HUD_FRAME, "gap-3")}>
      <TopBar />

      <div className="relative grid min-h-0 flex-1 items-start justify-between gap-3">
        <JournalIsland className="col-start-1" />

        <NoticeFeed className="absolute inset-x-0 top-0" />

        <div className="col-start-2 flex min-h-0 flex-col items-end gap-3 self-stretch">
          <InspectorIsland className="max-h-full min-h-0" />

          <PowerSettings className="mt-auto" />
        </div>
      </div>

      <div className="flex items-end gap-3">
        <div className="flex flex-1">
          <MinimapIsland />
        </div>

        <PowerDock />

        <div aria-hidden="true" className="flex-1" />
      </div>
    </div>
  );
}

function CompactDetails() {
  const powerId = usePowerStore((state) => state.selectedPowerId);

  if (powerId === null) {
    return <InspectorIsland className="max-h-details" />;
  }

  return <PowerSettings className="max-h-details" />;
}

function CompactHud() {
  return (
    <div className={cn(HUD_FRAME, "gap-2")}>
      <CompactTopBar />

      <NoticeFeed />

      <div className="flex-1" />

      <div className="flex min-h-0 flex-col gap-2">
        <MinimapIsland className="self-start" />

        <CompactDetails />

        <PowerDock />
      </div>

      <JournalSheet />
    </div>
  );
}

export function Hud() {
  const isCompact = useIsCompact();

  return (
    <>
      <WorldLabels />

      {isCompact ? <CompactHud /> : <WideHud />}

      <SettingsDialog />
    </>
  );
}
