import { describe, expect, it } from "vitest";
import { createRandom } from "../shared/random.ts";
import { personName, tribeIdentity } from "./names.ts";

describe("names", () => {
  it("names tribes and people deterministically", () => {
    expect(tribeIdentity(0).name).toBe("Bear Clan");
    expect(tribeIdentity(10).name).toBe("Bear Clan 2");
    expect(personName(createRandom(4), true)).toBe(personName(createRandom(4), true));
  });
});
