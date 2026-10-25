import type { WorldRules } from "../../content/world-rules.ts";
import type { RandomSource } from "../../shared/random.ts";
import type { HazardMap } from "../agents/hazards.ts";
import type { NavigationGrid } from "../agents/navigation.ts";
import type { Chronicle, ChronicleCategory } from "../chronicle.ts";
import type { EffectLog } from "../effects.ts";
import type { FaunaSystem } from "../fauna/fauna.ts";
import type { IdentifierSource } from "../identifiers.ts";
import type { Environment } from "../nature/environment.ts";
import type { FireSystem } from "../nature/fire.ts";
import type { WorldState } from "../world/world-state.ts";
import type { BuildingSystem } from "./buildings.ts";
import type { Person } from "./person.ts";
import type { RivalrySystem } from "./rivalry/rivalry-system.ts";
import type { SocietySystem } from "./society.ts";
import type { Tribe } from "./tribe.ts";

export interface DeathAccount {
  readonly category: ChronicleCategory;
  readonly text: string;
}

export interface SocietyContext {
  buildings: BuildingSystem;
  chronicle: Chronicle;
  effects: EffectLog;
  environment: Environment;
  fauna: FaunaSystem;
  fire: FireSystem;
  hazards: HazardMap;
  identifiers: IdentifierSource;
  navigation: NavigationGrid;
  people: SocietySystem;
  random: RandomSource;
  rivalry: RivalrySystem;
  rules: WorldRules;
  world: WorldState;
}

export interface PersonTick {
  context: SocietyContext;
  person: Person;
  seconds: number;
  tribe: Tribe;
}
