import { cn } from "../../design/cn.ts";
import { Divider } from "../../design/divider.tsx";
import { Island } from "../../design/island.tsx";
import { TimeControls } from "../time/time-controls.tsx";
import { CompactClock, WorldStatus } from "../time/world-status.tsx";
import { CompactMenu } from "./compact-menu.tsx";
import { MenuButtons } from "./menu-buttons.tsx";

const BAR_CLASS = "flex h-12 pointer-coarse:h-13 items-center";

export function TopBar({ className }: { readonly className?: string | undefined }) {
  return (
    <Island className={className}>
      <header className={cn(BAR_CLASS, "justify-between gap-3 px-1.5")}>
        <WorldStatus className="min-w-max pl-2.5 lg:flex-1 lg:basis-0" />

        <TimeControls className="shrink-0" />

        <div className="flex justify-end lg:flex-1 lg:basis-0">
          <MenuButtons />
        </div>
      </header>
    </Island>
  );
}

export function CompactTopBar({ className }: { readonly className?: string | undefined }) {
  return (
    <Island className={className}>
      <header className={cn(BAR_CLASS, "gap-2 pr-1 pl-3")}>
        <CompactClock className="flex-1" />

        <TimeControls className="shrink-0" />

        <Divider />

        <CompactMenu />
      </header>
    </Island>
  );
}
