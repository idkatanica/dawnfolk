import { cn } from "../design/cn.ts";
import { useIsCompact } from "../design/use-media-query.ts";
import { CompactTopBar, PanelBar, StatusCard } from "../features/interface/top-bar.tsx";
import { JournalSheet } from "../features/journal/journal-sheet.tsx";
import { SidePanel } from "../features/journal/side-panel.tsx";
import { WorldLabels } from "../features/labels/world-labels.tsx";
import { MinimapIsland } from "../features/minimap/minimap-island.tsx";
import { NoticeFeed } from "../features/notices/notice-feed.tsx";
import { PowerDock } from "../features/powers/power-dock.tsx";
import { PowerSettings } from "../features/powers/power-settings.tsx";
import { SettingsDialog } from "../features/settings/settings-dialog.tsx";

const HUD_FRAME = "pointer-events-none fixed inset-0 z-10 flex flex-col p-safe";

function WideHud() {
  return (
    <div className={cn(HUD_FRAME, "gap-3")}>
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_auto] grid-rows-[auto_minmax(0,1fr)] gap-3">
        <StatusCard className="justify-self-start" />

        <PanelBar className="self-center justify-self-end" />

        <NoticeFeed className="items-start" />

        <div className="flex min-h-0 flex-col items-end gap-3">
          <SidePanel className="max-h-full min-h-0" />

          <PowerSettings className="mt-auto" />
        </div>
      </div>

      <div className="flex items-end gap-3">
        <div className="flex min-w-fit flex-1">
          <MinimapIsland />
        </div>

        <PowerDock className="min-w-0" />

        <div aria-hidden="true" className="flex-1" />
      </div>
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
