import { useEffect, useRef } from "react";
import { cn } from "../design/cn.ts";
import { usePrefersCalm } from "../design/use-media-query.ts";
import type { IslandSketch } from "../generation/generation-options.ts";
import { paintIslandSketch } from "../rendering/minimap-image.ts";

const FADE_MILLISECONDS = 700;

function paintLayers(front: HTMLCanvasElement, back: HTMLCanvasElement, island: IslandSketch, isCalm: boolean): void {
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

  if (!isCalm) {
    front.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FADE_MILLISECONDS, easing: "ease-out" });
  }
}

interface IslandSketchViewProps {
  readonly className: string;
  readonly island: IslandSketch | null;
}

export function IslandSketchView({ className, island }: IslandSketchViewProps) {
  const frontRef = useRef<HTMLCanvasElement>(null);
  const backRef = useRef<HTMLCanvasElement>(null);
  const isCalm = usePrefersCalm();

  useEffect(() => {
    const front = frontRef.current;
    const back = backRef.current;

    if (island === null || front === null || back === null) {
      return;
    }

    paintLayers(front, back, island, isCalm);
  }, [island, isCalm]);

  return (
    <div className={cn("relative drop-shadow-xl", className)}>
      <canvas className="absolute inset-0 size-full" ref={backRef} />

      <canvas className="absolute inset-0 size-full" ref={frontRef} />
    </div>
  );
}
