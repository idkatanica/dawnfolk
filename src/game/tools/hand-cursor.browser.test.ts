import { describe, expect, it } from "vitest";
import { handCursorStyles, showHandCursor } from "./hand-cursor.ts";
import type { HandCursor } from "./hand-tool.ts";

const FALLBACKS: readonly (readonly [HandCursor, string])[] = [
  ["open", "grab"],
  ["closed", "grabbing"],
  ["blocked", "not-allowed"],
];

describe("hand cursor", () => {
  it.each(FALLBACKS)("draws the %s hand with a sharp image and falls back to %s", (cursor, fallback) => {
    const element = document.createElement("div");

    document.body.append(element);
    showHandCursor(element, cursor);

    const shown = getComputedStyle(element).cursor;

    element.remove();

    expect(shown).toContain("data:image/svg+xml");
    expect(shown).toContain("image-set");
    expect(shown.endsWith(fallback)).toBe(true);
  });

  it("goes back to the page cursor when the hand is put away", () => {
    const element = document.createElement("div");

    showHandCursor(element, "open");
    showHandCursor(element, "none");

    expect(element.style.cursor).toBe("");
    expect(handCursorStyles("none")).toEqual([""]);
  });
});
