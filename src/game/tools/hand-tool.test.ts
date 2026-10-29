import { Vector3 } from "three/webgpu";
import { describe, expect, it, vi } from "vitest";
import type { SimulationCommand } from "../../simulation/commands.ts";
import type { GrabTarget } from "../../simulation/hand/grab-target.ts";
import { HandTool } from "./hand-tool.ts";

const DEER: GrabTarget = { id: 7, kind: "animal" };
const SCREEN = { x: 40, y: 30 };
const PRESSED = new Vector3(10, 0, 20);
const CARRIED = new Vector3(30, 5, -12);

function createHand(target: GrabTarget | null = DEER) {
  const send = vi.fn<(command: SimulationCommand) => void>();
  const pick = vi.fn<() => GrabTarget | null>().mockReturnValue(target);

  const hand = new HandTool(send, pick);

  hand.select(true);

  return { hand, pick, send };
}

function press(hand: HandTool): void {
  if (hand.canBegin(PRESSED, SCREEN)) {
    hand.begin();
  }
}

describe("hand tool", () => {
  it("is active only while the hand is chosen", () => {
    const { hand } = createHand();

    expect(hand.isActive()).toBe(true);

    hand.select(false);

    expect(hand.isActive()).toBe(false);
    expect(hand.canBegin(PRESSED, SCREEN)).toBe(false);
  });

  it("begins only on something it can pick up", () => {
    expect(createHand().hand.canBegin(PRESSED, SCREEN)).toBe(true);
    expect(createHand(null).hand.canBegin(PRESSED, SCREEN)).toBe(false);
  });

  it("grabs, carries and drops", () => {
    const { hand, pick, send } = createHand();

    press(hand);
    hand.move(CARRIED);
    hand.end();

    expect(pick).toHaveBeenCalledOnce();
    expect(pick).toHaveBeenCalledWith(PRESSED, SCREEN);
    expect(send.mock.calls.flat()).toEqual([
      { target: DEER, type: "grab" },
      { type: "carry", x: CARRIED.x, z: CARRIED.z },
      { type: "drop" },
    ]);
  });

  it("cancels a grab and then has nothing left to drop", () => {
    const { hand, send } = createHand();

    press(hand);
    hand.cancel();
    hand.end();
    hand.move(CARRIED);

    expect(send.mock.calls.flat()).toEqual([{ target: DEER, type: "grab" }, { type: "cancelGrab" }]);
  });

  it("sends nothing when the press found nothing to pick up", () => {
    const { hand, send } = createHand(null);

    hand.canBegin(PRESSED, SCREEN);
    hand.begin();
    hand.move(CARRIED);
    hand.end();

    expect(send).not.toHaveBeenCalled();
  });

  it("returns what it holds when the hand is put away", () => {
    const { hand, send } = createHand();

    press(hand);
    hand.select(false);

    expect(send).toHaveBeenLastCalledWith({ type: "cancelGrab" });
    expect(hand.isActive()).toBe(false);
  });
});
