import { describe, expect, it } from "vitest";
import { POWER_ORDER, POWERS } from "../../content/powers.ts";
import { POWER_HANDLERS, parsePowerParameters } from "./power-registry.ts";

describe("power registry", () => {
  it("has a handler and valid defaults for every power", () => {
    for (const powerId of POWER_ORDER) {
      expect(POWER_HANDLERS[powerId]).toBeDefined();
      expect(parsePowerParameters(powerId, {})).toEqual(POWERS[powerId].parameters.parse({}));
    }
  });

  it("rejects parameters outside their range", () => {
    expect(parsePowerParameters("fire", { radius: 9000 })).toBeNull();
  });
});
