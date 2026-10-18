import { Tooltip } from "@base-ui/react/tooltip";
import type { ReactElement, ReactNode } from "react";

export type TooltipSide = "bottom" | "left" | "right" | "top";

export interface WithTooltipProps {
  readonly children: ReactElement;
  readonly content: ReactNode;
  readonly side?: TooltipSide;
}

const OPEN_DELAY = 450;

export function TooltipProvider({ children }: { readonly children: ReactNode }) {
  return <Tooltip.Provider delay={OPEN_DELAY}>{children}</Tooltip.Provider>;
}

export function WithTooltip({ children, content, side = "top" }: WithTooltipProps) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger render={children} />

      <Tooltip.Portal>
        <Tooltip.Positioner className="z-50" side={side} sideOffset={10}>
          <Tooltip.Popup className="pointer-coarse:hidden max-w-64 origin-[var(--transform-origin)] rounded-xl bg-ink/92 px-3 py-2 text-white text-xs leading-snug transition-[scale,opacity] duration-100 data-ending-style:scale-95 data-starting-style:scale-95 data-ending-style:opacity-0 data-starting-style:opacity-0">
            {content}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
