import type { BuildingKind } from "../../../content/buildings.ts";
import type { Mover } from "../../agents/movement.ts";
import type { Building } from "../buildings.ts";
import type { Person } from "../person.ts";

const WALL_COVER: Readonly<Partial<Record<BuildingKind, number>>> = { palisade: 0.3, stoneWall: 0.5 };

function isWithin(mover: Mover, wall: Building): boolean {
  return Math.hypot(mover.x - wall.x, mover.z - wall.z) < wall.extent;
}

export function wallCover(victim: Person, attacker: Person, buildings: readonly Building[]): number {
  let cover = 0;

  for (const building of buildings) {
    const shelter = WALL_COVER[building.kind];

    if (shelter === undefined || building.tribeId !== victim.tribeId || building.progress < 1) {
      continue;
    }

    if (isWithin(victim.mover, building) && !isWithin(attacker.mover, building)) {
      cover = Math.max(cover, shelter);
    }
  }

  return cover;
}
