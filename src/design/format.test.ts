import { describe, expect, it } from "vitest";
import { decimalsOf, formatClock, formatParameterValue, formatPercent } from "./format.ts";

describe("formatting", () => {
  it("counts the decimals a step needs", () => {
    expect(decimalsOf(1)).toBe(0);
    expect(decimalsOf(0.5)).toBe(1);
    expect(decimalsOf(0.25)).toBe(2);
  });

  it("formats each parameter unit", () => {
    expect(formatParameterValue(45, "meters")).toBe("45 m");
    expect(formatParameterValue(60, "percent", 5)).toBe("60%");
    expect(formatParameterValue(1.2, "multiplier", 0.1)).toBe("×1.2");
    expect(formatParameterValue(2.5, "seconds", 0.5)).toBe("2.5 s");
    expect(formatParameterValue(3, "celsius")).toBe("+3 °C");
    expect(formatParameterValue(-4, "celsius")).toBe("-4 °C");
    expect(formatParameterValue(14, "kilometersPerHour")).toBe("14 km/h");
    expect(formatParameterValue(1, "days")).toBe("1 day");
    expect(formatParameterValue(3, "days")).toBe("3 days");
    expect(formatParameterValue(7, "count")).toBe("7");
  });

  it("shows whole multipliers with one decimal", () => {
    expect(formatParameterValue(1, "multiplier", 0.1)).toBe("×1.0");
  });

  it("formats the time of day", () => {
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(9.5)).toBe("09:30");
    expect(formatClock(23.999)).toBe("23:59");
  });

  it("rounds shares to whole percents", () => {
    expect(formatPercent(0.456)).toBe("46%");
  });
});
