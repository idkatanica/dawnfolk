import { Biome } from "../../../content/biomes.ts";
import type { WorldState } from "../../world/world-state.ts";
import type { Tribe } from "../tribe.ts";

const WATER_SEARCH_RADIUS = 60;
const CAMP_RADIUS = 120;
const STEEP_GROUND = 0.6;

const BIOME_PLACES: Readonly<Record<number, string>> = {
  [Biome.Alpine]: "among the rocks",
  [Biome.Beach]: "on the shore",
  [Biome.Desert]: "in the desert",
  [Biome.Forest]: "in the forest",
  [Biome.Glacier]: "on the ice",
  [Biome.Meadow]: "in the meadows",
  [Biome.Mesa]: "among the mesas",
  [Biome.Scrub]: "in the scrubland",
  [Biome.Steppe]: "on the steppe",
  [Biome.Swamp]: "in the marsh",
  [Biome.Taiga]: "in the pinewoods",
  [Biome.Tundra]: "on the tundra",
};

function describeWaterNearby(world: WorldState, x: number, z: number): string | null {
  let isLake = false;

  for (const cell of world.grid.cellsInRadius(x, z, WATER_SEARCH_RADIUS)) {
    if (world.terrain.riverStrength[cell] > 0) {
      return "near the river";
    }

    if (world.isWater(cell)) {
      isLake = true;
    }
  }

  return isLake ? "by the lake" : null;
}

export function describePlace(world: WorldState, x: number, z: number, home: Tribe): string {
  if (Math.hypot(home.campX - x, home.campZ - z) < CAMP_RADIUS) {
    return "close to their camp";
  }

  const water = describeWaterNearby(world, x, z);

  if (water !== null) {
    return water;
  }

  const cell = world.grid.cellAt(x, z);

  if (cell < 0) {
    return "in the wilds";
  }

  if (world.slope(cell) > STEEP_GROUND) {
    return "on the slopes";
  }

  const place = BIOME_PLACES[world.terrain.biome[cell]];

  if (place === undefined) {
    return "in the wilds";
  }

  return place;
}
