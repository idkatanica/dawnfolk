import { describe, expect, it } from "vitest";
import { BIOMES, Biome } from "./biomes.ts";

describe("biomes", () => {
  it("lists biomes in the order of their indices", () => {
    expect(
      BIOMES.map((biome) => {
        return biome.index;
      })
    ).toEqual(
      BIOMES.map((_biome, position) => {
        return position;
      })
    );
    expect(BIOMES).toHaveLength(Object.keys(Biome).length);
  });
});
