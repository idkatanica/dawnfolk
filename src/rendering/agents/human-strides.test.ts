import { describe, expect, it } from "vitest";
import { personAppearance } from "../../models/people/appearance.ts";
import { HUMAN_CLIPS } from "../../models/people/human-clips.ts";
import { HumanStrides } from "./human-strides.ts";

const TRIBE = { accent: 0xc4_55_3a, fur: 0x6b_4a_33, id: 1 };
const strides = new HumanStrides();

describe("human strides", () => {
  it("steps faster the faster a person walks", () => {
    const appearance = personAppearance({ age: 30, isFemale: false, seed: 0.4, tribe: TRIBE });

    const slow = strides.cyclesPerSecond("walk", 1.5, appearance);
    const fast = strides.cyclesPerSecond("walk", 3, appearance);

    expect(slow).toBeGreaterThan(0);
    expect(fast).toBeCloseTo(slow * 2);
  });

  it("matches an adult walk to a believable cadence", () => {
    const appearance = personAppearance({ age: 30, isFemale: true, seed: 0.7, tribe: TRIBE });

    const cycles = strides.cyclesPerSecond("walk", 2.5, appearance);

    expect(cycles).toBeGreaterThan(0.6);
    expect(cycles).toBeLessThan(2.2);
  });

  it("uses the clip length for clips that do not travel", () => {
    const appearance = personAppearance({ age: 30, isFemale: false, seed: 0.2, tribe: TRIBE });
    const { timing } = HUMAN_CLIPS.chop;

    if (timing.kind !== "seconds") {
      throw new Error("Chopping should be timed in seconds");
    }

    expect(strides.cyclesPerSecond("chop", 0, appearance)).toBeCloseTo(1 / timing.cycleSeconds);
  });

  it("gives children shorter strides", () => {
    const adult = personAppearance({ age: 30, isFemale: false, seed: 0.3, tribe: TRIBE });
    const child = personAppearance({ age: 6, isFemale: false, seed: 0.3, tribe: TRIBE });

    expect(strides.cyclesPerSecond("walk", 2, child)).toBeGreaterThan(strides.cyclesPerSecond("walk", 2, adult));
  });
});
