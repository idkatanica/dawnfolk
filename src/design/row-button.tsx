import type { ReactNode } from "react";
import { cn } from "./cn.ts";
import { FOCUS_RING } from "./styles.ts";

interface RowButtonProps {
  readonly children: ReactNode;
  readonly className?: string | undefined;
  readonly leading: ReactNode;
  readonly onClick: () => void;
  readonly trailing?: ReactNode;
}

interface RowCountProps {
  readonly count: number;
  readonly unit: string;
}

export function RowButton({ children, className, leading, onClick, trailing }: RowButtonProps) {
  return (
    <li>
      <button
        className={cn(
          "hover:bg-paper-hover flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition-colors",
          FOCUS_RING,
          className
        )}
        onClick={onClick}
        type="button"
      >
        {leading}

        <span className="flex min-w-0 flex-1 flex-col gap-0.5">{children}</span>

        {trailing}
      </button>
    </li>
  );
}

export function RowCount({ count, unit }: RowCountProps) {
  return (
    <span className="flex flex-col items-end gap-0.5">
      <span className="text-ink text-lg leading-none font-semibold tabular-nums">{count}</span>

      <span className="text-ink-muted text-xs">{unit}</span>
    </span>
  );
}
