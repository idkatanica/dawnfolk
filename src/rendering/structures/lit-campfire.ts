import type { BuildingView } from "../../simulation/frame.ts";

const LIT_CAMPFIRE_FUEL = 0.02;

export function isLitCampfire(building: BuildingView): boolean {
  return building.kind === "campfire" && building.progress >= 1 && building.fuel > LIT_CAMPFIRE_FUEL;
}
