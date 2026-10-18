import { GlassSurface, type GlassSurfaceOptions } from "@svidskiy/glass-surface-react";
import type { ReactNode } from "react";
import { cn } from "./cn.ts";
import { useIsTouch } from "./use-media-query.ts";

const ISLAND_RADIUS = 22;

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

interface IslandProps {
  readonly children: ReactNode;
  readonly className?: string | undefined;
}

export function Island({ children, className }: IslandProps) {
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
