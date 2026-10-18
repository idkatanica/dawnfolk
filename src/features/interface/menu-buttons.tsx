import { BookOpen, Map as MapIcon, Maximize2, Minimize2, Settings } from "lucide-react";
import { IconButton } from "../../design/buttons.tsx";
import { cn } from "../../design/cn.ts";
import { WithTooltip } from "../../design/tooltip.tsx";
import { useInterfaceStore } from "./interface-store.ts";
import { useFullscreen } from "./use-fullscreen.ts";

function FullscreenButton() {
  const { canGoFullscreen, isFullscreen, toggleFullscreen } = useFullscreen();

  if (!canGoFullscreen) {
    return null;
  }

  const label = isFullscreen ? "Leave full screen" : "Full screen";
  const Icon = isFullscreen ? Minimize2 : Maximize2;

  return (
    <WithTooltip content={label} side="bottom">
      <IconButton icon={<Icon aria-hidden="true" size={18} />} label={label} onClick={toggleFullscreen} />
    </WithTooltip>
  );
}

function useMenuActions() {
  const isJournalOpen = useInterfaceStore((state) => state.isJournalOpen);
  const isMapOpen = useInterfaceStore((state) => state.isMapOpen);
  const toggleJournal = useInterfaceStore((state) => state.toggleJournal);
  const toggleMap = useInterfaceStore((state) => state.toggleMap);
  const openSettings = useInterfaceStore((state) => state.openSettings);

  const showSettings = () => openSettings("world");

  return { isJournalOpen, isMapOpen, showSettings, toggleJournal, toggleMap };
}

export function MenuButtons({ className }: { readonly className?: string | undefined }) {
  const { isJournalOpen, isMapOpen, showSettings, toggleJournal, toggleMap } = useMenuActions();

  return (
    <nav aria-label="Panels" className={cn("flex items-center gap-1", className)}>
      <WithTooltip content="Tribes and chronicle" side="bottom">
        <IconButton
          icon={<BookOpen aria-hidden="true" size={18} />}
          isPressed={isJournalOpen}
          label="Journal"
          onClick={toggleJournal}
        />
      </WithTooltip>

      <WithTooltip content="Map of the island" side="bottom">
        <IconButton
          icon={<MapIcon aria-hidden="true" size={18} />}
          isPressed={isMapOpen}
          label="Map"
          onClick={toggleMap}
        />
      </WithTooltip>

      <WithTooltip content="World, weather, time and graphics" side="bottom">
        <IconButton icon={<Settings aria-hidden="true" size={18} />} label="Settings" onClick={showSettings} />
      </WithTooltip>

      <FullscreenButton />
    </nav>
  );
}
