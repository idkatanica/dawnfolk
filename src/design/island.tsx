import type { ReactNode } from "react";
import { cn } from "./cn.ts";
import { PAPER_SURFACE } from "./styles.ts";

interface IslandProps {
  readonly children: ReactNode;
  readonly className?: string | undefined;
}

export function Island({ children, className }: IslandProps) {
  return <div className={cn("island rounded-island text-ink", PAPER_SURFACE, className)}>{children}</div>;
}
