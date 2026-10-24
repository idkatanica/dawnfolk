import { describe, expect, it } from "vitest";
import { toError } from "./errors.ts";

describe("errors", () => {
  it("keeps an error as it is", () => {
    const error = new Error("The worker crashed");

    expect(toError(error)).toBe(error);
  });

  it("wraps anything else in an error", () => {
    expect(toError("out of memory")).toEqual(new Error("out of memory"));
  });
});
