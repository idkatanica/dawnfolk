import { describe, expect, it } from "vitest";
import { calendarAt } from "../testing/test-calendar.ts";
import { describeEnvironment, droughtLevel } from "./environment.ts";
import { WeatherSystem } from "./weather.ts";

describe("drought", () => {
  it("is highest in a dry summer and drops with rain", () => {
    expect(droughtLevel(1.6, 0, false)).toBeGreaterThan(droughtLevel(3.6, 0, false));
    expect(droughtLevel(1.6, 1, false)).toBeLessThan(droughtLevel(1.6, 0, false));
    expect(droughtLevel(1.6, 0, true)).toBe(1);
  });
});

describe("environment", () => {
  it("combines season, time of day and weather into the air temperature", () => {
    const calendar = calendarAt(4.5);
    const weather = new WeatherSystem();

    weather.setUserTemperatureOffset(-20);

    const environment = describeEnvironment(calendar, weather);

    const expected = calendar.seasonalTemperatureOffset() + calendar.diurnalTemperatureOffset() - 20;

    expect(environment.airTemperatureOffset).toBeCloseTo(expected);
  });

  it("has sunlight by day and none at night", () => {
    const weather = new WeatherSystem();

    const noon = describeEnvironment(calendarAt(4.5), weather);
    const midnight = describeEnvironment(calendarAt(4), weather);

    expect(noon.sunlight).toBeGreaterThan(0.5);
    expect(midnight.sunlight).toBe(0);
    expect(midnight.isNight).toBe(true);
  });
});
