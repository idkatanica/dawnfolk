import { cn } from "../../design/cn.ts";
import { Divider } from "../../design/divider.tsx";
import { Island } from "../../design/island.tsx";
import { TimeControls } from "../time/time-controls.tsx";
import { CompactClock, WorldStatus } from "../time/world-status.tsx";
import { CompactMenu } from "./compact-menu.tsx";
import { MenuButtons } from "./menu-buttons.tsx";

const BAR_CLASS = "flex h-12 pointer-coarse:h-13 items-center";

export function StatusCard({ className }: { readonly className?: string | undefined }) {
  return (
    <Island className={className}>
      <header className="flex flex-col gap-3 p-3">
        <WorldStatus />

        <TimeControls />
      </header>
    </Island>
  );
}

export function PanelBar({ className }: { readonly className?: string | undefined }) {
  return (
    <Island className={className}>
      <MenuButtons className={cn(BAR_CLASS, "px-1.5")} />
    </Island>
  );
}

export function CompactTopBar() {
  return (
    <Island>
      <header className={cn(BAR_CLASS, "gap-2 pr-1 pl-3")}>
        <CompactClock className="flex-1" />

        <TimeControls />

        <Divider />

        <CompactMenu />
      </header>
    </Island>
  );
}
