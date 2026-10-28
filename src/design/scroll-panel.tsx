import { ScrollArea } from "@base-ui/react/scroll-area";
import type { ReactNode } from "react";
import { cn } from "./cn.ts";

interface ScrollPanelProps {
  readonly children: ReactNode;
  readonly className?: string | undefined;
}

export function ScrollPanel({ children, className }: ScrollPanelProps) {
  return (
    <ScrollArea.Root className="flex min-h-0 flex-1 flex-col">
      <ScrollArea.Viewport
        className={cn("scroll-fade relative min-h-0 flex-1 overscroll-contain outline-none", className)}
      >
        {children}
      </ScrollArea.Viewport>

      <ScrollArea.Scrollbar className="-mr-2 w-1.5 rounded-full py-1 opacity-0 transition-opacity data-hovering:opacity-100 data-scrolling:opacity-100">
        <ScrollArea.Thumb className="bg-ink/25 w-full rounded-full" />
      </ScrollArea.Scrollbar>
    </ScrollArea.Root>
  );
}
