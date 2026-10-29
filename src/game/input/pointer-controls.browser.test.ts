import { PerspectiveCamera } from "three/webgpu";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GodCamera } from "../camera/god-camera.ts";
import { GroundPicker } from "./ground-picker.ts";
import { PointerControls, type TapHandler, type ToolGestures } from "./pointer-controls.ts";

const WORLD_HALF_SIZE = 4000;
const CANVAS_WIDTH = 390;
const CANVAS_HEIGHT = 844;
const HOLD_MILLISECONDS = 400;

type ToolSpy = ReturnType<typeof createTool>;

interface Rig {
  readonly camera: GodCamera;
  readonly canvas: HTMLCanvasElement;
  readonly controls: PointerControls;
  readonly tool: ToolSpy;
}

const rigs: Rig[] = [];

function settle(camera: GodCamera): void {
  for (let step = 0; step < 60; step += 1) {
    camera.update(0.1);
  }
}

function isAlwaysTrue(): boolean {
  return true;
}

function isNeverTrue(): boolean {
  return false;
}

function createTool(canBegin: () => boolean, isActive: () => boolean) {
  return {
    begin: vi.fn<ToolGestures["begin"]>(),
    canBegin,
    cancel: vi.fn<ToolGestures["cancel"]>(),
    end: vi.fn<ToolGestures["end"]>(),
    hover: vi.fn<ToolGestures["hover"]>(),
    isActive,
    move: vi.fn<ToolGestures["move"]>(),
    tap: vi.fn<TapHandler["tap"]>(),
  };
}

function createRig(canBegin: () => boolean = isAlwaysTrue, leading: ToolSpy | null = null): Rig {
  const canvas = document.createElement("canvas");

  canvas.style.cssText = `position: fixed; left: 0; top: 0; width: ${CANVAS_WIDTH}px; height: ${CANVAS_HEIGHT}px`;
  canvas.setPointerCapture = vi.fn();
  document.body.append(canvas);

  const perspective = new PerspectiveCamera(45, CANVAS_WIDTH / CANVAS_HEIGHT, 1, 40_000);
  const camera = new GodCamera(
    perspective,
    () => {
      return 0;
    },
    WORLD_HALF_SIZE
  );

  camera.jumpTo({ distance: 600, targetX: 0, targetZ: 0 });
  settle(camera);

  const tool = createTool(canBegin, isAlwaysTrue);
  const tools = leading === null ? [tool] : [leading, tool];
  const picker = new GroundPicker(perspective, () => 0, WORLD_HALF_SIZE);
  const rig = { camera, canvas, controls: new PointerControls(canvas, camera, picker, tools, tool), tool };

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

function mouse(rig: Rig, type: string, x: number, y: number): void {
  rig.canvas.dispatchEvent(
    new PointerEvent(type, { button: 0, clientX: x, clientY: y, pointerId: 1, pointerType: "mouse" })
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

  it("sends a gesture only to the first active tool", () => {
    const inactive = createTool(isAlwaysTrue, isNeverTrue);
    const rig = createRig(isAlwaysTrue, inactive);

    mouse(rig, "pointerdown", 195, 420);
    mouse(rig, "pointermove", 205, 420);
    mouse(rig, "pointerup", 205, 420);

    expect(rig.tool.begin).toHaveBeenCalledTimes(1);
    expect(rig.tool.move).toHaveBeenCalled();
    expect(rig.tool.end).toHaveBeenCalledTimes(1);
    expect([inactive.begin, inactive.move, inactive.end].map((spy) => spy.mock.calls.length)).toEqual([0, 0, 0]);
  });

  it("leaves a later tool alone while an earlier one is active", () => {
    const leading = createTool(isAlwaysTrue, isAlwaysTrue);
    const rig = createRig(isAlwaysTrue, leading);

    mouse(rig, "pointerdown", 195, 420);
    mouse(rig, "pointermove", 205, 420);
    mouse(rig, "pointerup", 205, 420);

    expect(leading.begin).toHaveBeenCalledTimes(1);
    expect(leading.end).toHaveBeenCalledTimes(1);
    expect([rig.tool.begin, rig.tool.move, rig.tool.end].map((spy) => spy.mock.calls.length)).toEqual([0, 0, 0]);
  });

  it("pans when the tool has nothing to take under the pointer", () => {
    const rig = createRig(isNeverTrue);

    const before = rig.camera.state.targetX;

    mouse(rig, "pointerdown", 195, 420);

    for (let step = 1; step <= 10; step += 1) {
      mouse(rig, "pointermove", 195 + step * 10, 420);
    }

    mouse(rig, "pointerup", 295, 420);
    settle(rig.camera);

    expect(rig.tool.begin).not.toHaveBeenCalled();
    expect(rig.tool.move).not.toHaveBeenCalled();
    expect(rig.camera.state.targetX).not.toBeCloseTo(before);
  });

  it("cancels the tool rather than finishing it when the browser takes the pointer away", () => {
    const rig = createRig();

    mouse(rig, "pointerdown", 195, 420);
    mouse(rig, "pointermove", 205, 420);
    mouse(rig, "pointercancel", 205, 420);

    expect(rig.tool.cancel).toHaveBeenCalledTimes(1);
    expect(rig.tool.end).not.toHaveBeenCalled();
  });
});
