import { useEffect, useRef } from "react";
import { paintCloudSea } from "../rendering/atmosphere/cloud-sea-image.ts";

const CLOUD_PIXELS = 240;

export function CloudSeaBackdrop({ seed }: { readonly seed: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (canvas === null) {
      return;
    }

    const context = canvas.getContext("2d");

    if (context === null) {
      return;
    }

    const width = CLOUD_PIXELS;
    const height = Math.max(1, Math.round((CLOUD_PIXELS * window.innerHeight) / window.innerWidth));

    canvas.width = width;
    canvas.height = height;
    context.putImageData(paintCloudSea(width, height, seed), 0, 0);
  }, [seed]);

  return <canvas className="absolute inset-0 size-full" ref={canvasRef} />;
}
