import { PerspectiveCamera } from "three/webgpu";
import { describe, expect, it } from "vitest";
import { GroundPicker } from "./ground-picker.ts";

const VIEWPORT = { height: 600, width: 800 };
const CENTER = { x: 400, y: 300 };

function cameraLookingAt(x: number, z: number): PerspectiveCamera {
  const camera = new PerspectiveCamera(45, VIEWPORT.width / VIEWPORT.height, 1, 40_000);

  camera.position.set(x, 400, z + 300);
  camera.lookAt(x, 0, z);
  camera.updateMatrixWorld();

  return camera;
}

describe("ground picker", () => {
  it("finds the point under the screen centre on flat ground", () => {
    const picker = new GroundPicker(cameraLookingAt(100, -50), () => 0, 2000);

    const hit = picker.pick(CENTER, VIEWPORT);

    expect(hit?.x).toBeCloseTo(100, 0);
    expect(hit?.z).toBeCloseTo(-50, 0);
  });

  it("lands on the slope of uneven ground", () => {
    function heightAt(x: number): number {
      return x * 0.2;
    }

    const picker = new GroundPicker(cameraLookingAt(0, 0), heightAt, 2000);

    const hit = picker.pick(CENTER, VIEWPORT);

    if (hit === null) {
      throw new Error("The ray should hit the slope");
    }

    expect(hit.y).toBeCloseTo(heightAt(hit.x), 3);
  });

  it("misses when the ray leaves the island", () => {
    const picker = new GroundPicker(cameraLookingAt(0, 0), () => 0, 50);

    expect(picker.pick({ x: 0, y: 0 }, VIEWPORT)).toBeNull();
  });
});
