import { describe, expect, it } from "vitest";
import { WEATHER, WEATHER_KINDS } from "./weather.ts";

describe("weather", () => {
  it("defines weather for every kind with odds for each season", () => {
    for (const kind of WEATHER_KINDS) {
      expect(WEATHER[kind].seasonalOdds).toHaveLength(4);
    }
  });
});
