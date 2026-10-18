import { describe, expect, it } from "vitest";
import { FramePacer } from "./frame-pacer.ts";

const DISPLAY_FRAME = 1000 / 120;

function renderedFrames(pacer: FramePacer, hasFocus: boolean, start: number, frames: number): number {
  let rendered = 0;

  for (let frame = 0; frame < frames; frame += 1) {
    const now = start + frame * DISPLAY_FRAME;

    if (pacer.isFrameDue(now, hasFocus)) {
      pacer.markRendered(now);
      rendered += 1;
    }
  }

  return rendered;
}

describe("frame pacer", () => {
  it("renders the first frame right away", () => {
    expect(new FramePacer().isFrameDue(0, true)).toBe(true);
  });

  it("follows the display while the player is acting", () => {
    const pacer = new FramePacer();

    pacer.markActivity(0);

    expect(renderedFrames(pacer, true, 0, 120)).toBe(120);
  });

  it("settles to 60 frames a second once the player stops", () => {
    const pacer = new FramePacer();

    pacer.markActivity(0);
    renderedFrames(pacer, true, 0, 180);

    expect(renderedFrames(pacer, true, 180 * DISPLAY_FRAME, 120)).toBe(60);
  });

  it("drops to 30 frames a second when the window loses focus", () => {
    const pacer = new FramePacer();

    pacer.markActivity(0);

    expect(renderedFrames(pacer, false, 0, 120)).toBe(30);
  });
});
