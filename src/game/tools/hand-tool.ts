import type { Vector3 } from "three/webgpu";
import { ignore } from "../../shared/ignore.ts";
import type { SimulationCommand } from "../../simulation/commands.ts";
import type { GrabTarget } from "../../simulation/hand/grab-target.ts";
import type { ScreenPoint } from "../input/ground-picker.ts";
import type { ToolGestures } from "../input/pointer-controls.ts";

type CommandSink = (command: SimulationCommand) => void;

type GrabPicker = (point: Vector3, screen: ScreenPoint) => GrabTarget | null;

type HandState = "holding" | "idle" | "putAway";

export class HandTool implements ToolGestures {
  readonly hover = ignore;
  readonly #pick: GrabPicker;
  readonly #send: CommandSink;
  #state: HandState = "putAway";

  constructor(send: CommandSink, pick: GrabPicker) {
    this.#send = send;
    this.#pick = pick;
  }

  select(isSelected: boolean): void {
    if (!isSelected) {
      this.cancel();
      this.#state = "putAway";

      return;
    }

    if (this.#state === "putAway") {
      this.#state = "idle";
    }
  }

  isActive(): boolean {
    return this.#state !== "putAway";
  }

  canBegin(point: Vector3, screen: ScreenPoint): boolean {
    return this.isActive() && this.#pick(point, screen) !== null;
  }

  begin(point: Vector3, screen: ScreenPoint): void {
    if (!this.isActive()) {
      return;
    }

    const target = this.#pick(point, screen);

    if (target === null) {
      return;
    }

    this.cancel();
    this.#send({ target, type: "grab" });
    this.#state = "holding";
  }

  move(point: Vector3): void {
    if (this.#state !== "holding") {
      return;
    }

    this.#send({ type: "carry", x: point.x, z: point.z });
  }

  end(): void {
    if (this.#state !== "holding") {
      return;
    }

    this.#state = "idle";
    this.#send({ type: "drop" });
  }

  cancel(): void {
    if (this.#state !== "holding") {
      return;
    }

    this.#state = "idle";
    this.#send({ type: "cancelGrab" });
  }
}
