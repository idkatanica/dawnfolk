import { PerspectiveCamera } from "three/webgpu";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GodCamera } from "../camera/god-camera.ts";
import { GroundPicker } from "./ground-picker.ts";
import { PointerControls } from "./pointer-controls.ts";

const WORLD_HALF_SIZE = 4000;
const CANVAS_WIDTH = 390;
const CANVAS_HEIGHT = 844;
const HOLD_MILLISECONDS = 400;

interface Rig {
  readonly camera: GodCamera;
  readonly canvas: HTMLCanvasElement;
  readonly controls: PointerControls;
  readonly tool: {
    readonly begin: ReturnType<typeof vi.fn>;
    readonly end: ReturnType<typeof vi.fn>;
    readonly hover: ReturnType<typeof vi.fn>;
    readonly isActive: () => boolean;
    readonly move: ReturnType<typeof vi.fn>;
    readonly tap: ReturnType<typeof vi.fn>;
  };
}

const rigs: Rig[] = [];

function settle(camera: GodCamera): void {
  for (let step = 0; step < 60; step += 1) {
    camera.update(0.1);
  }
}

function createRig(): Rig {
  const canvas = document.createElement("canvas");

  canvas.style.cssText = `position: fixed; left: 0; top: 0; width: ${CANVAS_WIDTH}px; height: ${CANVAS_HEIGHT}px`;
  canvas.setPointerCapture = vi.fn();
  document.body.append(canvas);

  const perspective = new PerspectiveCamera(45, CANVAS_WIDTH / CANVAS_HEIGHT, 1, 40_000);
  const camera = new GodCamera(perspective, () => 0, WORLD_HALF_SIZE);

  camera.jumpTo({ distance: 600, targetX: 0, targetZ: 0 });
  settle(camera);

  const tool = { begin: vi.fn(), end: vi.fn(), hover: vi.fn(), isActive: () => true, move: vi.fn(), tap: vi.fn() };
  const picker = new GroundPicker(perspective, () => 0, WORLD_HALF_SIZE);
  const rig = { camera, canvas, controls: new PointerControls(canvas, camera, picker, tool, tool), tool };

  rigs.push(rig);

  return rig;
}

function touch(rig: Rig, type: string, pointerId: number, x: number, y: number): void {
  rig.canvas.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      clientX: x,
      clientY: y,
      isPrimary: pointerId === 1,
      pointerId,
      pointerType: "touch",
    })
  );
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

describe("pointer controls", () => {
  afterEach(() => {
    for (const rig of rigs.splice(0)) {
      rig.controls.dispose();
      rig.canvas.remove();
    }
  });

  it("zooms with a pinch and never uses the power while a tool is selected", () => {
    const rig = createRig();

    const before = rig.camera.state.distance;

    touch(rig, "pointerdown", 1, 150, 420);
    touch(rig, "pointerdown", 2, 240, 420);

    for (let step = 1; step <= 10; step += 1) {
      touch(rig, "pointermove", 1, 150 + step * 4, 420);
      touch(rig, "pointermove", 2, 240 - step * 4, 420);
    }

    touch(rig, "pointerup", 1, 190, 420);
    touch(rig, "pointerup", 2, 200, 420);
    settle(rig.camera);

    expect(rig.tool.begin).not.toHaveBeenCalled();
    expect(rig.tool.move).not.toHaveBeenCalled();
    expect(rig.tool.tap).not.toHaveBeenCalled();
    expect(rig.camera.state.distance).toBeGreaterThan(before);
  });

  it("ignores a pinch whose second finger lands after a short pause", async () => {
    const rig = createRig();

    touch(rig, "pointerdown", 1, 150, 420);
    await wait(60);
    touch(rig, "pointerdown", 2, 240, 420);
    touch(rig, "pointermove", 1, 170, 420);
    touch(rig, "pointermove", 2, 220, 420);
    touch(rig, "pointerup", 1, 170, 420);
    await wait(HOLD_MILLISECONDS);
    touch(rig, "pointerup", 2, 220, 420);

    expect(rig.tool.begin).not.toHaveBeenCalled();
  });

  it("uses the power once on a single tap", () => {
    const rig = createRig();

    touch(rig, "pointerdown", 1, 195, 420);
    touch(rig, "pointerup", 1, 195, 420);

    expect(rig.tool.begin).toHaveBeenCalledTimes(1);
    expect(rig.tool.end).toHaveBeenCalledTimes(1);
    expect(rig.tool.tap).not.toHaveBeenCalled();
  });

  it("starts a stroke once one finger has stayed down alone", async () => {
    const rig = createRig();

    touch(rig, "pointerdown", 1, 195, 420);

    expect(rig.tool.begin).not.toHaveBeenCalled();

    await wait(HOLD_MILLISECONDS);

    expect(rig.tool.begin).toHaveBeenCalledTimes(1);

    touch(rig, "pointermove", 1, 215, 430);

    expect(rig.tool.move).toHaveBeenCalled();

    touch(rig, "pointerup", 1, 215, 430);

    expect(rig.tool.end).toHaveBeenCalledTimes(1);
  });

  it("drops a waiting touch that the browser cancels", async () => {
    const rig = createRig();

    touch(rig, "pointerdown", 1, 195, 420);
    touch(rig, "pointercancel", 1, 195, 420);
    await wait(HOLD_MILLISECONDS);

    expect(rig.tool.begin).not.toHaveBeenCalled();
  });

  it("starts at once with a mouse", () => {
    const rig = createRig();

    rig.canvas.dispatchEvent(
      new PointerEvent("pointerdown", { button: 0, clientX: 195, clientY: 420, pointerId: 1, pointerType: "mouse" })
    );

    expect(rig.tool.begin).toHaveBeenCalledTimes(1);
  });
});
