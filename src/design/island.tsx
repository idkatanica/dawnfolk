import { GlassSurface, type GlassSurfaceOptions } from "@svidskiy/glass-surface-react";
import type { ReactNode } from "react";
import { cn } from "./cn.ts";
import { useIsTouch } from "./use-media-query.ts";

const ISLAND_RADIUS = 18;

export type IslandSurface = "glass" | "solid";

const REFRACTING_GLASS: Partial<GlassSurfaceOptions> = {
  backgroundOpacity: 0.5,
  blueOffset: 8,
  displace: 1.5,
  distortionScale: -90,
  greenOffset: 4,
  saturation: 1.5,
};

const FROSTED_GLASS: Partial<GlassSurfaceOptions> = { ...REFRACTING_GLASS, backgroundOpacity: 0.68, refraction: false };

interface IslandProps {
  readonly children: ReactNode;
  readonly className?: string | undefined;
  readonly surface?: IslandSurface | undefined;
}

function GlassIsland({ children, className }: Omit<IslandProps, "surface">) {
  const isTouch = useIsTouch();

  const glass = isTouch ? FROSTED_GLASS : REFRACTING_GLASS;

  return (
    <GlassSurface
      {...glass}
      borderRadius={ISLAND_RADIUS}
      className={cn("island", className)}
      height="auto"
      width="auto"
    >
      {children}
    </GlassSurface>
  );
}

export function Island({ children, className, surface = "solid" }: IslandProps) {
  if (surface === "glass") {
    return <GlassIsland className={className}>{children}</GlassIsland>;
  }

  return (
    <div className={cn("island island-solid rounded-island border border-paper-edge bg-paper text-ink", className)}>
      {children}
    </div>
  );
}
