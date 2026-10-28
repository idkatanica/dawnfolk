import { describe, expect, it } from "vitest";
import { BIOMES, Biome } from "./biomes.ts";

describe("biomes", () => {
  it("lists biomes in the order of their indices", () => {
    expect(BIOMES.map((biome) => biome.index)).toEqual(BIOMES.map((_biome, position) => position));
    expect(BIOMES).toHaveLength(Object.keys(Biome).length);
  });
});
