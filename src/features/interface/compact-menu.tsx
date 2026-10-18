import { Menu } from "@base-ui/react/menu";
import { BookOpen, Map as MapIcon, Maximize2, Menu as MenuIcon, Settings } from "lucide-react";
import type { ReactNode } from "react";
import { IconButton } from "../../design/buttons.tsx";
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
      className="flex h-11 cursor-default select-none items-center gap-3 rounded-xl px-3 text-ink text-sm outline-none data-highlighted:bg-dawn-soft"
      onClick={onClick}
    >
      <span className="text-ink-soft">{icon}</span>

      {children}
    </Menu.Item>
  );
}

function useCompactMenu() {
  const openJournal = useInterfaceStore((state) => state.openJournal);
  const toggleMap = useInterfaceStore((state) => state.toggleMap);
  const openSettings = useInterfaceStore((state) => state.openSettings);
  const isMapOpen = useInterfaceStore((state) => state.isMapOpen);

  function showJournal(): void {
    openJournal("tribes");
  }

  function showSettings(): void {
    openSettings("world");
  }

  return { isMapOpen, showJournal, showSettings, toggleMap };
}

function FullscreenEntry() {
  const { canGoFullscreen, toggleFullscreen } = useFullscreen();

  if (!canGoFullscreen) {
    return null;
  }

  return (
    <MenuEntry icon={<Maximize2 aria-hidden="true" size={17} />} onClick={toggleFullscreen}>
      Full screen
    </MenuEntry>
  );
}

export function CompactMenu() {
  const { isMapOpen, showJournal, showSettings, toggleMap } = useCompactMenu();

  return (
    <Menu.Root>
      <Menu.Trigger render={<IconButton icon={<MenuIcon aria-hidden="true" size={19} />} label="Menu" />} />

      <Menu.Portal>
        <Menu.Positioner align="end" className="z-50 outline-none" sideOffset={10}>
          <Menu.Popup className="min-w-52 origin-(--transform-origin) rounded-2xl bg-white/94 p-1.5 outline-none backdrop-blur-2xl transition-[scale,opacity] duration-150 data-ending-style:scale-95 data-starting-style:scale-95 data-ending-style:opacity-0 data-starting-style:opacity-0">
            <MenuEntry icon={<BookOpen aria-hidden="true" size={17} />} onClick={showJournal}>
              Tribes and chronicle
            </MenuEntry>

            <MenuEntry icon={<MapIcon aria-hidden="true" size={17} />} onClick={toggleMap}>
              {isMapOpen ? "Hide the map" : "Show the map"}
            </MenuEntry>

            <MenuEntry icon={<Settings aria-hidden="true" size={17} />} onClick={showSettings}>
              Settings
            </MenuEntry>

            <FullscreenEntry />
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
