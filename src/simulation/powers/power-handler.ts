import type { PowerId, PowerParameters } from "../../content/powers.ts";
import type { EmberSystem } from "../nature/embers.ts";
import type { SocietyContext } from "../society/society-context.ts";

export interface PowerTarget {
  seconds: number;
  strokeStartHeight: number;
  x: number;
  z: number;
}

export interface PowerServices extends SocietyContext {
  embers: EmberSystem;
  schedule: (delaySeconds: number, task: () => void) => void;
}

export type PowerOutcome = { kind: "applied" } | { kind: "refused"; reason: string };

export interface PowerHandler<Id extends PowerId> {
  apply: (target: PowerTarget, parameters: PowerParameters<Id>, services: PowerServices) => PowerOutcome;
}

export const APPLIED: PowerOutcome = { kind: "applied" };

export function refused(reason: string): PowerOutcome {
  return { kind: "refused", reason };
}

export function percent(value: number): number {
  return value / 100;
}
