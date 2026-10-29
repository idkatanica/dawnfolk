import type { BadgeTone } from "../../design/badge.tsx";
import type { GameIconName } from "../../design/game-icon-sources.ts";
import type { RaidPhase } from "../../simulation/society/rivalry/raids.ts";
import type { Stance } from "../../simulation/society/rivalry/relations.ts";
import type { RaidView, RelationView, RivalryView } from "../../simulation/society/rivalry/rivalry-system.ts";

interface StanceLook {
  readonly icon: GameIconName;
  readonly label: string;
  readonly tone: BadgeTone;
}

export const STANCE_LOOKS: Readonly<Record<Stance, StanceLook>> = {
  friendly: { icon: "peace", label: "Friendly", tone: "meadow" },
  hostile: { icon: "raid", label: "Hostile", tone: "ember" },
  neutral: { icon: "neutral", label: "Neutral", tone: "muted" },
  wary: { icon: "shield", label: "Wary", tone: "dawn" },
};

export const RAID_PHASE_LABELS: Readonly<Record<RaidPhase, string>> = {
  assault: "Fighting at the camp",
  march: "On the march",
  muster: "Gathering warriors",
  retreat: "Heading home",
};

const STANCE_ORDER: readonly Stance[] = ["hostile", "wary", "neutral", "friendly"];

export function isRelationOf(relation: RelationView, tribeId: number): boolean {
  return relation.firstId === tribeId || relation.secondId === tribeId;
}

export function otherTribeOf(relation: RelationView, tribeId: number): number {
  return relation.firstId === tribeId ? relation.secondId : relation.firstId;
}

export function byStance(first: RelationView, second: RelationView): number {
  const order = STANCE_ORDER.indexOf(first.stance) - STANCE_ORDER.indexOf(second.stance);

  if (order !== 0) {
    return order;
  }

  return first.standing - second.standing;
}

export function relationNote(relation: RelationView): string | null {
  const fallen = relation.firstDeaths + relation.secondDeaths;
  const notes: string[] = [];

  if (relation.feudDays !== null) {
    notes.push(`Feud for ${Math.max(1, Math.round(relation.feudDays))} d`);
  }

  if (relation.isTruce) {
    notes.push("Truce");
  }

  if (relation.isKin) {
    notes.push("Kin");
  }

  if (fallen > 0) {
    notes.push(`${fallen} fallen`);
  }

  if (notes.length === 0) {
    return null;
  }

  return notes.join(" · ");
}

export function raidOf(rivalry: RivalryView, tribeId: number): RaidView | null {
  const raid = rivalry.raids.find((candidate) => {
    return candidate.attackerId === tribeId || candidate.defenderId === tribeId;
  });

  if (raid === undefined) {
    return null;
  }

  return raid;
}

export function isFeuding(rivalry: RivalryView, tribeId: number): boolean {
  return rivalry.relations.some((relation) => {
    return relation.stance === "hostile" && isRelationOf(relation, tribeId);
  });
}
