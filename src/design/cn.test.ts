import { describe, expect, it } from "vitest";
import { cn } from "./cn.ts";

describe("class names", () => {
  it("joins plain classes and drops empty values", () => {
    expect(cn("flex", undefined, null, false, "gap-2")).toBe("flex gap-2");
  });

  it("keeps only the classes whose condition holds", () => {
    expect(cn("rounded-md", { "bg-dawn": true, "text-ink": false })).toBe("rounded-md bg-dawn");
  });

  it("lets a later utility replace a conflicting earlier one", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });

  it("treats the design system colours as colours", () => {
    expect(cn("text-ink-soft text-sm", "text-dawn")).toBe("text-sm text-dawn");
  });

  it("lets a caller's class override a component's default", () => {
    expect(cn("flex flex-col gap-1.5", "gap-3")).toBe("flex flex-col gap-3");
  });
});
