import { Menu } from "@base-ui/react/menu";
import { BookOpen, Map as MapIcon, Maximize2, Menu as MenuIcon, Minimize2, Settings } from "lucide-react";
import type { ReactNode } from "react";
import { IconButton } from "../../design/buttons.tsx";
import { useSidePanel } from "../journal/use-side-panel.ts";
import { useInterfaceStore } from "./interface-store.ts";
import { useFullscreen } from "./use-fullscreen.ts";

function MenuEntry({
  children,
  icon,
  onClick,
}: {
  readonly children: ReactNode;
  readonly icon: ReactNode;
  readonly onClick: () => void;
}) {
  return (
    <Menu.Item
      className="text-ink data-highlighted:bg-paper-hover flex h-11 cursor-default items-center gap-3 rounded-xl px-3 text-sm outline-none select-none"
      onClick={onClick}
    >
      <span className="text-ink-soft">{icon}</span>

      {children}
    </Menu.Item>
  );
}

function useCompactMenu() {
  const { openJournal } = useSidePanel();
  const toggleMap = useInterfaceStore((state) => state.toggleMap);
  const openSettings = useInterfaceStore((state) => state.openSettings);
  const isMapOpen = useInterfaceStore((state) => state.isMapOpen);

  function showJournal(): void {
    openJournal("tribes");
  }

  return { isMapOpen, openSettings, showJournal, toggleMap };
}

function FullscreenEntry() {
  const { canGoFullscreen, isFullscreen, toggleFullscreen } = useFullscreen();

  if (!canGoFullscreen) {
    return null;
  }

  const Icon = isFullscreen ? Minimize2 : Maximize2;

  return (
    <MenuEntry icon={<Icon aria-hidden="true" size={17} />} onClick={toggleFullscreen}>
      {isFullscreen ? "Leave full screen" : "Full screen"}
    </MenuEntry>
  );
}

export function CompactMenu() {
  const { isMapOpen, openSettings, showJournal, toggleMap } = useCompactMenu();

  return (
    <Menu.Root>
      <Menu.Trigger render={<IconButton icon={<MenuIcon aria-hidden="true" size={19} />} label="Menu" />} />

      <Menu.Portal>
        <Menu.Positioner align="end" className="z-50" sideOffset={10}>
          <Menu.Popup className="rounded-island border-paper-edge bg-paper min-w-52 origin-(--transform-origin) border p-1.5 transition-[scale,opacity] duration-150 outline-none data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
            <MenuEntry icon={<BookOpen aria-hidden="true" size={17} />} onClick={showJournal}>
              Tribes and chronicle
            </MenuEntry>

            <MenuEntry icon={<MapIcon aria-hidden="true" size={17} />} onClick={toggleMap}>
              {isMapOpen ? "Hide the map" : "Show the map"}
            </MenuEntry>

            <MenuEntry icon={<Settings aria-hidden="true" size={17} />} onClick={openSettings}>
              Settings
            </MenuEntry>

            <FullscreenEntry />
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
