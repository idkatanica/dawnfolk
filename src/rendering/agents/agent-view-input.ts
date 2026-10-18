import type { Frustum, PerspectiveCamera } from "three/webgpu";
import type { WorldMirror } from "../../game/world-mirror.ts";
import type { AgentMarkers } from "./agent-markers.ts";

export interface AgentViewInput {
  readonly camera: PerspectiveCamera;
  readonly detail: number;
  readonly frustum: Frustum;
  readonly gameSeconds: number;
  readonly markers: AgentMarkers;
  readonly mirror: WorldMirror;
  readonly realSeconds: number;
  readonly secondsSinceTick: number;
}

export interface LevelDistances {
  readonly far: number;
  readonly high: number;
  readonly low: number;
}

export const HIDDEN_LEVEL = -1;
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
  return Math.max(mirror.heightAt(x, z), mirror.surfaceAt(x, z) - wadingDepth);
}
