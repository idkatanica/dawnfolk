import type { ReactNode } from "react";
import { cn } from "./cn.ts";

interface IslandProps {
  readonly children: ReactNode;
  readonly className?: string | undefined;
}

export function Island({ children, className }: IslandProps) {
  return (
    <div className={cn("island rounded-island border border-paper-edge bg-paper text-ink", className)}>{children}</div>
  );
}
