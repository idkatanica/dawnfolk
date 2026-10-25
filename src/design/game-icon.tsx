import { cn } from "./cn.ts";
import { GAME_ICON_SOURCES, type GameIconName } from "./game-icon-sources.ts";

interface GameIconProps {
  readonly className?: string | undefined;
  readonly label?: string | undefined;
  readonly name: GameIconName;
  readonly size?: number | undefined;
}

export function GameIcon({ className, label, name, size = 24 }: GameIconProps) {
  return (
    <img
      alt={label === undefined ? "" : label}
      className={cn("pointer-events-none inline-block shrink-0 select-none", className)}
      decoding="async"
      draggable={false}
      height={size}
      src={GAME_ICON_SOURCES[name]}
      width={size}
    />
  );
}
