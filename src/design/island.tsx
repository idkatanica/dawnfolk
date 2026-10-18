import { GlassSurface, type GlassSurfaceOptions } from "@svidskiy/glass-surface-react";
import type { ReactNode } from "react";
import { cn } from "./cn.ts";
import { useIsTouch } from "./use-media-query.ts";

export const ISLAND_RADIUS = 22;

const REFRACTING_GLASS: Partial<GlassSurfaceOptions> = {
  backgroundOpacity: 0.5,
  blueOffset: 8,
  brightness: 50,
  displace: 1.5,
  distortionScale: -90,
  greenOffset: 4,
  saturation: 1.5,
};

const FROSTED_GLASS: Partial<GlassSurfaceOptions> = { ...REFRACTING_GLASS, backgroundOpacity: 0.68, refraction: false };

export interface IslandProps {
  readonly children: ReactNode;
  readonly className?: string | undefined;
  readonly radius?: number | undefined;
}

export function Island({ children, className, radius = ISLAND_RADIUS }: IslandProps) {
  const isTouch = useIsTouch();

  const glass = isTouch ? FROSTED_GLASS : REFRACTING_GLASS;

  return (
    <GlassSurface {...glass} borderRadius={radius} className={cn("island", className)} height="auto" width="auto">
      {children}
    </GlassSurface>
  );
}
