import { PerspectiveCamera } from "three/webgpu";
import { describe, expect, it } from "vitest";
import { GodCamera } from "./god-camera.ts";

const HALF_SIZE = 2560;
const REACH = 10_000;

function createCamera(): GodCamera {
  return new GodCamera(new PerspectiveCamera(50, 1.6, 1, 50_000), () => 0, HALF_SIZE);
}

describe("god camera", () => {
  it("frames the ground around the target when looking down", () => {
    const camera = createCamera();

    camera.jumpTo({ distance: 1000, pitch: 1.48, targetX: 300, targetZ: -200, yaw: 0 });

    const footprint = camera.groundFootprint(REACH);

    const centerX = footprint.reduce((sum, point) => sum + point.x, 0) / footprint.length;
    const centerZ = footprint.reduce((sum, point) => sum + point.z, 0) / footprint.length;

    expect(footprint).toHaveLength(4);
    expect(centerX).toBeCloseTo(300, -1);
    expect(centerZ).toBeCloseTo(-200, -2);
  });

  it("reaches toward the horizon in the direction the camera faces", () => {
    const camera = createCamera();

    camera.jumpTo({ distance: 2000, pitch: 0.2, targetX: 0, targetZ: 0, yaw: 0 });

    const footprint = camera.groundFootprint(REACH);

    const nearest = Math.max(...footprint.map((point) => point.z));
    const farthest = Math.min(...footprint.map((point) => point.z));

    expect(nearest).toBeGreaterThan(0);
    expect(farthest).toBeLessThan(-REACH / 2);
  });
});
