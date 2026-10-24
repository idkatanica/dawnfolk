import { cn } from "../../design/cn.ts";

interface TribeDotProps {
  readonly color: string;
  readonly size?: "medium" | "small" | undefined;
}

export function TribeDot({ color, size = "medium" }: TribeDotProps) {
  return (
    <span
      aria-hidden="true"
      className={cn("shrink-0 rounded-full ring-2 ring-white", size === "small" ? "size-2.5" : "size-3")}
      style={{ backgroundColor: color }}
    />
  );
}
