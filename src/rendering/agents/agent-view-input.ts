import type { WorldMirror } from "../../game/world-mirror.ts";
import { footingOn } from "../../world/crossings.ts";
import type { ViewInput } from "../view-input.ts";
import type { AgentMarkers } from "./agent-markers.ts";

export interface AgentViewInput extends ViewInput {
  readonly gameSeconds: number;
  readonly markers: AgentMarkers;
  readonly realSeconds: number;
  readonly secondsSinceTick: number;
}

export interface LevelDistances {
  readonly far: number;
  readonly high: number;
  readonly low: number;
}

export const HIDDEN_LEVEL = -1;

const ANKLE_DEPTH = 0.18;
export const NO_SELECTION = -1;

export function detailLevel(distance: number, limits: LevelDistances, detail: number): number {
  if (distance < limits.high * detail) {
    return 0;
  }

  if (distance < limits.low * detail) {
    return 1;
  }

  if (distance < farthestFigure(limits, detail)) {
    return 2;
  }

  return HIDDEN_LEVEL;
}

export function farthestFigure(limits: LevelDistances, detail: number): number {
  return limits.far * detail;
}

export function standingHeight(mirror: WorldMirror, x: number, z: number, wadingDepth: number): number {
  const ground = mirror.heightAt(x, z);
  const crossing = mirror.crossingAt(x, z);

  if (crossing !== null) {
    return footingOn(crossing, x, z, ground, mirror.waterLevelAt(x, z));
  }

  if (mirror.isBrookAt(x, z)) {
    return Math.max(ground, mirror.surfaceAt(x, z) - ANKLE_DEPTH);
  }

  return Math.max(ground, mirror.surfaceAt(x, z) - wadingDepth);
}
