import { describe, expect, it } from "vitest";
import { readStoredGuide, useGuideStore } from "./guide-store.ts";
import { FRESH_GUIDE } from "./guide-tips.ts";

describe("guide store", () => {
  it("reads saved progress and drops tips that no longer exist", () => {
    expect(readStoredGuide({ done: ["look", "volcano"], isOff: false })).toEqual({ ...FRESH_GUIDE, done: ["look"] });
  });

  it("starts fresh from a broken save", () => {
    expect(readStoredGuide({ done: "look" })).toEqual(FRESH_GUIDE);
  });

  it("starts the tips again when they are turned back on", () => {
    useGuideStore.getState().record({ kind: "cameraMoved" });
    useGuideStore.getState().setTipsShown(false);
    useGuideStore.getState().setTipsShown(true);

    expect(useGuideStore.getState().progress).toEqual(FRESH_GUIDE);
  });
});
