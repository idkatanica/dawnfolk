import { GlassSurface, type GlassSurfaceOptions } from "@svidskiy/glass-surface-react";
import type { ReactNode } from "react";
import { cn } from "./cn.ts";
import { useIsTouch } from "./use-media-query.ts";

const ISLAND_RADIUS = 22;

const PANEL_RADIUS = 28;

type IslandFrost = "clear" | "dense";

const REFRACTING_GLASS: Partial<GlassSurfaceOptions> = {
  backgroundOpacity: 0.5,
  blueOffset: 8,
  displace: 1.5,
  distortionScale: -90,
  greenOffset: 4,
  saturation: 1.5,
};

const FROSTED_GLASS: Partial<GlassSurfaceOptions> = { ...REFRACTING_GLASS, backgroundOpacity: 0.68, refraction: false };

const DENSE_REFRACTING_GLASS: Partial<GlassSurfaceOptions> = {
  ...REFRACTING_GLASS,
  backgroundOpacity: 0.66,
  displace: 4,
  distortionScale: -70,
};

const DENSE_FROSTED_GLASS: Partial<GlassSurfaceOptions> = { ...FROSTED_GLASS, backgroundOpacity: 0.8 };

interface GlassLooks {
  readonly frosted: Partial<GlassSurfaceOptions>;
  readonly refracting: Partial<GlassSurfaceOptions>;
}

const GLASS: Readonly<Record<IslandFrost, GlassLooks>> = {
  clear: { frosted: FROSTED_GLASS, refracting: REFRACTING_GLASS },
  dense: { frosted: DENSE_FROSTED_GLASS, refracting: DENSE_REFRACTING_GLASS },
};

const RADIUS: Readonly<Record<IslandFrost, number>> = { clear: ISLAND_RADIUS, dense: PANEL_RADIUS };

interface IslandProps {
  readonly children: ReactNode;
  readonly className?: string | undefined;
  readonly frost?: IslandFrost | undefined;
}

export function Island({ children, className, frost = "clear" }: IslandProps) {
  const isTouch = useIsTouch();

  const looks = GLASS[frost];
  const glass = isTouch ? looks.frosted : looks.refracting;

  return (
    <GlassSurface
      {...glass}
      borderRadius={RADIUS[frost]}
      className={cn("island", className)}
      height="auto"
      width="auto"
    >
      {children}
    </GlassSurface>
  );
}
