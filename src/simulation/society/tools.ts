import { TOOL_MATERIAL_DEFINITIONS } from "../../content/weapons.ts";
import type { Tribe } from "./tribe.ts";

export function workSpeed(tribe: Tribe): number {
  return TOOL_MATERIAL_DEFINITIONS[tribe.tools].workSpeed;
}

export function workSeconds(tribe: Tribe, seconds: number): number {
  return seconds / workSpeed(tribe);
}
