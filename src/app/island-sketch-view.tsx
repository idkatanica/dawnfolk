import { useEffect, useRef } from "react";
import { cn } from "../design/cn.ts";
import { useShouldReduceMotion } from "../design/use-media-query.ts";
import type { IslandSketch } from "../generation/generation-options.ts";
import { paintIslandSketch } from "../rendering/minimap-image.ts";

const FADE_MILLISECONDS = 700;

interface IslandSketchViewProps {
  readonly className: string;
  readonly island: IslandSketch | null;
}

function paintLayers(
  front: HTMLCanvasElement,
  back: HTMLCanvasElement,
  island: IslandSketch,
  shouldReduceMotion: boolean
): void {
  const frontContext = front.getContext("2d");
  const backContext = back.getContext("2d");

  if (frontContext === null || backContext === null) {
    return;
  }

  back.width = front.width;
  back.height = front.height;
  backContext.drawImage(front, 0, 0);

  front.width = island.cellsPerSide;
  front.height = island.cellsPerSide;
  frontContext.putImageData(paintIslandSketch(island), 0, 0);

  if (!shouldReduceMotion) {
    front.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FADE_MILLISECONDS, easing: "ease-out" });
  }
}

export function IslandSketchView({ className, island }: IslandSketchViewProps) {
  const frontReference = useRef<HTMLCanvasElement>(null);
  const backReference = useRef<HTMLCanvasElement>(null);
  const shouldReduceMotion = useShouldReduceMotion();

  useEffect(() => {
    const front = frontReference.current;
    const back = backReference.current;

    if (island === null || front === null || back === null) {
      return;
    }

    paintLayers(front, back, island, shouldReduceMotion);
  }, [island, shouldReduceMotion]);

  return (
    <div className={cn("relative drop-shadow-xl", className)}>
      <canvas className="absolute inset-0 size-full" ref={backReference} />

      <canvas className="absolute inset-0 size-full" ref={frontReference} />
    </div>
  );
}
