import { cn } from "../design/cn.ts";
import { Island } from "../design/island.tsx";
import { useIsCompact } from "../design/use-media-query.ts";
import { InspectorIsland } from "../features/inspector/inspector-island.tsx";
import { CompactMenu } from "../features/interface/compact-menu.tsx";
import { MenuButtons } from "../features/interface/menu-buttons.tsx";
import { JournalIsland } from "../features/journal/journal-island.tsx";
import { JournalSheet } from "../features/journal/journal-sheet.tsx";
import { WorldLabels } from "../features/labels/world-labels.tsx";
import { MinimapIsland } from "../features/minimap/minimap-island.tsx";
import { NoticeFeed } from "../features/notices/notice-feed.tsx";
import { PowerDock } from "../features/powers/power-dock.tsx";
import { PowerSettings } from "../features/powers/power-settings.tsx";
import { usePowerStore } from "../features/powers/power-store.ts";
import { SettingsDialog } from "../features/settings/settings-dialog.tsx";
import { TimeControls } from "../features/time/time-controls.tsx";
import { CompactClock, WorldStatus } from "../features/time/world-status.tsx";

const HUD_FRAME = "pointer-events-none fixed inset-0 z-10 flex flex-col p-safe";

function WideHud() {
  return (
    <div className={cn(HUD_FRAME, "gap-3")}>
      <div className="flex items-start gap-3">
        <WorldStatus />

        <div className="flex flex-1 justify-center">
          <Island>
            <TimeControls className="p-1.5" />
          </Island>
        </div>

        <Island>
          <MenuButtons className="p-1.5" />
        </Island>
      </div>

      <div className="relative grid min-h-0 flex-1 grid-cols-[auto_auto] items-start justify-between gap-3">
        <JournalIsland className="col-start-1 row-start-1" />

        <NoticeFeed className="pointer-events-none absolute inset-x-0 top-0" />

        <div className="col-start-2 row-start-1 flex min-h-0 flex-col items-end gap-3 self-stretch">
          <InspectorIsland />

          <PowerSettings className="mt-auto" />
        </div>
      </div>

      <div className="flex items-end gap-3">
        <div className="flex flex-1 items-end">
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
      <div className="flex items-start gap-2">
        <Island className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 py-1 pr-1 pl-3">
            <CompactClock className="flex-1" />

            <TimeControls className="shrink-0" />
          </div>
        </Island>

        <Island>
          <div className="p-1">
            <CompactMenu />
          </div>
        </Island>
      </div>

      <NoticeFeed />

      <div className="min-h-0 flex-1" />

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
