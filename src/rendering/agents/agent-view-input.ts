import type { Frustum, PerspectiveCamera } from "three/webgpu";
import type { WorldMirror } from "../../game/world-mirror.ts";
import type { AgentDots } from "./agent-dots.ts";

export interface AgentViewInput {
  readonly camera: PerspectiveCamera;
  readonly detail: number;
  readonly dots: AgentDots;
  readonly frustum: Frustum;
  readonly gameSeconds: number;
  readonly mirror: WorldMirror;
  readonly realSeconds: number;
  readonly secondsSinceTick: number;
}

export interface LevelDistances {
  readonly high: number;
  readonly low: number;
}

export const HIDDEN_LEVEL = -1;

export function detailLevel(distance: number, limits: LevelDistances, detail: number): number {
  if (distance < limits.high * detail) {
    return 0;
  }

  if (distance < limits.low * detail) {
    return 1;
  }

  return HIDDEN_LEVEL;
}

export function standingHeight(mirror: WorldMirror, x: number, z: number, wadingDepth: number): number {
  return Math.max(mirror.heightAt(x, z), mirror.surfaceAt(x, z) - wadingDepth);
}
