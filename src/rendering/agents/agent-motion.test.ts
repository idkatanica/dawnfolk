import { describe, expect, it } from "vitest";
import { AgentMotion, BLEND_SECONDS, ONCE_END, TURN_RATE } from "./agent-motion.ts";

const WALK = 1;
const RUN = 2;
const FALL = 3;
const DEAD = 4;

describe("AgentMotion", () => {
  it("advances the phase by game time and the clip rate", () => {
    const motion = new AgentMotion(WALK, 0.1, 0);

    motion.advance({ clip: WALK, gameSeconds: 0.5, heading: 0, isOnce: false, rate: 0.6, realSeconds: 0.5 });

    expect(motion.phase).toBeCloseTo(0.4);
  });

  it("wraps the phase into one cycle", () => {
    const motion = new AgentMotion(WALK, 0.9, 0);

    motion.advance({ clip: WALK, gameSeconds: 1, heading: 0, isOnce: false, rate: 0.3, realSeconds: 1 });

    expect(motion.phase).toBeCloseTo(0.2);
  });

  it("blends from the previous clip after a change", () => {
    const motion = new AgentMotion(WALK, 0.25, 0);

    motion.advance({ clip: RUN, gameSeconds: 0, heading: 0, isOnce: false, rate: 1, realSeconds: BLEND_SECONDS / 2 });

    expect(motion.previousClip).toBe(WALK);
    expect(motion.clip).toBe(RUN);
    expect(motion.blend).toBeCloseTo(0.5);
  });

  it("finishes blending after the blend time", () => {
    const motion = new AgentMotion(WALK, 0, 0);

    motion.advance({ clip: RUN, gameSeconds: 0, heading: 0, isOnce: false, rate: 1, realSeconds: BLEND_SECONDS * 2 });

    expect(motion.blend).toBe(1);
  });

  it("turns toward the heading at a limited rate", () => {
    const motion = new AgentMotion(WALK, 0, 0);

    motion.advance({ clip: WALK, gameSeconds: 0.1, heading: 2, isOnce: false, rate: 0, realSeconds: 0.1 });

    expect(motion.heading).toBeCloseTo(TURN_RATE * 0.1);
  });

  it("turns the short way around", () => {
    const motion = new AgentMotion(WALK, 0, 3);

    motion.advance({ clip: WALK, gameSeconds: 1, heading: -3, isOnce: false, rate: 0, realSeconds: 1 });

    expect(motion.heading).toBeCloseTo(-3);
  });

  it("starts a one-shot clip from its first frame and holds its last", () => {
    const motion = new AgentMotion(WALK, 0.6, 0);

    motion.advance({ clip: FALL, gameSeconds: 0.2, heading: 0, isOnce: true, rate: 1, realSeconds: 0.2 });

    expect(motion.phase).toBeCloseTo(0.2);

    motion.advance({ clip: FALL, gameSeconds: 3, heading: 0, isOnce: true, rate: 1, realSeconds: 3 });

    expect(motion.phase).toBe(ONCE_END);
  });

  it("holds the last frame of a one-shot clip while it blends out", () => {
    const motion = new AgentMotion(WALK, 0, 0);

    motion.advance({ clip: FALL, gameSeconds: 3, heading: 0, isOnce: true, rate: 1, realSeconds: 3 });
    motion.advance({ clip: DEAD, gameSeconds: 0.1, heading: 0, isOnce: false, rate: 0, realSeconds: 0.1 });

    expect(motion.previousClip).toBe(FALL);
    expect(motion.previousPhase).toBe(ONCE_END);
  });
});
