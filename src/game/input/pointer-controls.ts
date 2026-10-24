import type { Vector3 } from "three/webgpu";
import type { GodCamera } from "../camera/god-camera.ts";
import type { GroundPicker, ScreenPoint } from "./ground-picker.ts";

export interface ToolGestures {
  readonly begin: (point: Vector3) => void;
  readonly end: () => void;
  readonly hover: (point: Vector3 | null) => void;
  readonly isActive: () => boolean;
  readonly move: (point: Vector3) => void;
}

export interface TapHandler {
  readonly tap: (point: Vector3 | null, screen: ScreenPoint) => void;
}

interface TrackedPointer {
  readonly button: number;
  readonly startX: number;
  readonly startY: number;
  x: number;
  y: number;
}

interface PinchMeasure {
  readonly angle: number;
  readonly distance: number;
  readonly middleX: number;
  readonly middleY: number;
}

type Gesture =
  | { readonly kind: "idle" }
  | { readonly kind: "orbit" }
  | { readonly kind: "pan"; travel: number }
  | { readonly kind: "tool" }
  | { readonly kind: "waiting"; readonly point: Vector3 }
  | { distance: number; readonly kind: "pinch"; angle: number; middleX: number; middleY: number };

const MOUSE_PRIMARY = 0;
const TOUCH_HOLD_MILLISECONDS = 140;
const TAP_TOLERANCE = 6;
const ORBIT_YAW_PER_PIXEL = 0.005;
const ORBIT_PITCH_PER_PIXEL = 0.004;
const WHEEL_ZOOM_RATE = 0.0015;
const WHEEL_LINE_PIXELS = 16;

function wheelPixels(event: WheelEvent, pageHeight: number): number {
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
    return event.deltaY * WHEEL_LINE_PIXELS;
  }

  if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    return event.deltaY * pageHeight;
  }

  return event.deltaY;
}

function measurePinch(pointers: ReadonlyMap<number, TrackedPointer>): PinchMeasure | null {
  const [first, second] = [...pointers.values()];

  if (first === undefined || second === undefined) {
    return null;
  }

  return {
    angle: Math.atan2(second.y - first.y, second.x - first.x),
    distance: Math.hypot(second.x - first.x, second.y - first.y),
    middleX: (first.x + second.x) / 2,
    middleY: (first.y + second.y) / 2,
  };
}

export class PointerControls {
  readonly #camera: GodCamera;
  readonly #canvas: HTMLCanvasElement;
  readonly #picker: GroundPicker;
  readonly #pointers = new Map<number, TrackedPointer>();
  readonly #tap: TapHandler;
  readonly #tool: ToolGestures;
  readonly #abort = new AbortController();
  #gesture: Gesture = { kind: "idle" };
  #holdTimer: number | null = null;

  constructor(canvas: HTMLCanvasElement, camera: GodCamera, picker: GroundPicker, tool: ToolGestures, tap: TapHandler) {
    this.#canvas = canvas;
    this.#camera = camera;
    this.#picker = picker;
    this.#tool = tool;
    this.#tap = tap;

    const options = { signal: this.#abort.signal };

    canvas.addEventListener("pointerdown", (event) => this.#down(event), options);
    canvas.addEventListener("pointermove", (event) => this.#move(event), options);
    canvas.addEventListener("pointerup", (event) => this.#up(event, true), options);
    canvas.addEventListener("pointercancel", (event) => this.#up(event, false), options);
    canvas.addEventListener("pointerleave", () => this.#tool.hover(null), options);
    canvas.addEventListener("wheel", (event) => this.#wheel(event), { passive: false, signal: this.#abort.signal });
    canvas.addEventListener("contextmenu", (event) => event.preventDefault(), options);
  }

  dispose(): void {
    this.#stopHold();
    this.#abort.abort();
  }

  #down(event: PointerEvent): void {
    this.#canvas.setPointerCapture(event.pointerId);
    this.#pointers.set(event.pointerId, {
      button: event.button,
      startX: event.offsetX,
      startY: event.offsetY,
      x: event.offsetX,
      y: event.offsetY,
    });

    if (this.#pointers.size === 2) {
      this.#beginPinch();

      return;
    }

    if (this.#pointers.size === 1) {
      this.#beginSingle(event);
    }
  }

  #beginSingle(event: PointerEvent): void {
    if (event.pointerType === "mouse" && event.button !== MOUSE_PRIMARY) {
      this.#gesture = { kind: "orbit" };

      return;
    }

    const point = this.#pick(event.offsetX, event.offsetY);

    if (!this.#tool.isActive() || point === null) {
      this.#gesture = { kind: "pan", travel: 0 };

      return;
    }

    if (event.pointerType === "touch") {
      this.#waitForSecondTouch(point);

      return;
    }

    this.#gesture = { kind: "tool" };
    this.#tool.begin(point);
  }

  #waitForSecondTouch(point: Vector3): void {
    this.#gesture = { kind: "waiting", point };
    this.#tool.hover(point);
    this.#holdTimer = window.setTimeout(() => this.#commitTool(this.#onlyPointer()), TOUCH_HOLD_MILLISECONDS);
  }

  #onlyPointer(): TrackedPointer | null {
    const [pointer, other] = [...this.#pointers.values()];

    if (pointer === undefined || other !== undefined) {
      return null;
    }

    return pointer;
  }

  #commitTool(pointer: TrackedPointer | null): void {
    const gesture = this.#gesture;

    this.#stopHold();

    if (gesture.kind !== "waiting" || pointer === null) {
      return;
    }

    this.#gesture = { kind: "tool" };
    this.#tool.begin(gesture.point);
    this.#continueTool(pointer);
  }

  #stopHold(): void {
    if (this.#holdTimer === null) {
      return;
    }

    window.clearTimeout(this.#holdTimer);
    this.#holdTimer = null;
  }

  #beginPinch(): void {
    this.#stopHold();

    if (this.#gesture.kind === "tool") {
      this.#tool.end();
    }

    this.#tool.hover(null);

    const pinch = measurePinch(this.#pointers);

    if (pinch === null) {
      return;
    }

    this.#gesture = { ...pinch, kind: "pinch" };
  }

  #move(event: PointerEvent): void {
    const pointer = this.#pointers.get(event.pointerId);

    if (pointer === undefined) {
      this.#hover(event);

      return;
    }

    const deltaX = event.offsetX - pointer.x;
    const deltaY = event.offsetY - pointer.y;

    pointer.x = event.offsetX;
    pointer.y = event.offsetY;
    this.#continueGesture(pointer, deltaX, deltaY);
  }

  #continueGesture(pointer: TrackedPointer, deltaX: number, deltaY: number): void {
    const gesture = this.#gesture;

    switch (gesture.kind) {
      case "orbit":
        this.#camera.orbit(-deltaX * ORBIT_YAW_PER_PIXEL, deltaY * ORBIT_PITCH_PER_PIXEL);
        break;
      case "pan":
        gesture.travel = Math.max(gesture.travel, Math.hypot(pointer.x - pointer.startX, pointer.y - pointer.startY));
        this.#camera.pan(deltaX, deltaY, this.#canvas.clientHeight);
        break;
      case "pinch":
        this.#continuePinch(gesture);
        break;
      case "tool":
        this.#continueTool(pointer);
        break;
      default:
        break;
    }
  }

  #continueTool(pointer: TrackedPointer): void {
    const point = this.#pick(pointer.x, pointer.y);

    if (point !== null) {
      this.#tool.move(point);
    }
  }

  #continuePinch(gesture: Extract<Gesture, { kind: "pinch" }>): void {
    const pinch = measurePinch(this.#pointers);

    if (pinch === null) {
      return;
    }

    this.#camera.zoom(gesture.distance / Math.max(1, pinch.distance), this.#pick(pinch.middleX, pinch.middleY));
    this.#camera.orbit(pinch.angle - gesture.angle, 0);
    this.#camera.pan(pinch.middleX - gesture.middleX, pinch.middleY - gesture.middleY, this.#canvas.clientHeight);

    gesture.distance = pinch.distance;
    gesture.angle = pinch.angle;
    gesture.middleX = pinch.middleX;
    gesture.middleY = pinch.middleY;
  }

  #up(event: PointerEvent, isReleased: boolean): void {
    const pointer = this.#pointers.get(event.pointerId);

    this.#pointers.delete(event.pointerId);

    if (pointer === undefined) {
      return;
    }

    if (isReleased) {
      this.#finishGesture(pointer);
    } else {
      this.#abandonGesture();
    }

    if (this.#pointers.size === 0) {
      this.#gesture = { kind: "idle" };

      return;
    }

    if (this.#gesture.kind === "pinch") {
      this.#gesture = { kind: "pan", travel: TAP_TOLERANCE };
    }
  }

  #abandonGesture(): void {
    this.#stopHold();

    if (this.#gesture.kind === "tool") {
      this.#tool.end();
    }

    if (this.#gesture.kind === "waiting") {
      this.#tool.hover(null);
    }

    this.#gesture = { kind: "idle" };
  }

  #finishGesture(pointer: TrackedPointer): void {
    if (this.#gesture.kind === "waiting") {
      this.#commitTool(pointer);
    }

    const gesture = this.#gesture;

    if (gesture.kind === "tool") {
      this.#tool.end();
      this.#gesture = { kind: "idle" };

      return;
    }

    if (gesture.kind === "pan" && gesture.travel < TAP_TOLERANCE) {
      const screen = { x: pointer.x, y: pointer.y };

      this.#tap.tap(this.#pick(pointer.x, pointer.y), screen);
    }
  }

  #hover(event: PointerEvent): void {
    if (event.pointerType !== "mouse" || !this.#tool.isActive()) {
      return;
    }

    this.#tool.hover(this.#pick(event.offsetX, event.offsetY));
  }

  #wheel(event: WheelEvent): void {
    event.preventDefault();

    const factor = Math.exp(wheelPixels(event, this.#canvas.clientHeight) * WHEEL_ZOOM_RATE);

    this.#camera.zoom(factor, this.#pick(event.offsetX, event.offsetY));
  }

  #pick(x: number, y: number): Vector3 | null {
    return this.#picker.pick({ x, y }, { height: this.#canvas.clientHeight, width: this.#canvas.clientWidth });
  }
}
