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
import type { DeathCause, Person } from "./person.ts";
import type { RivalrySystem } from "./rivalry/rivalry-system.ts";
import type { Tribe } from "./tribe.ts";

export interface DeathAccount {
  readonly category: ChronicleCategory;
  readonly text: string;
}

export interface PeopleDirectory {
  countNear: (x: number, z: number, radius: number, accepts: (person: Person) => boolean) => number;
  findPerson: (id: number) => Person | null;
  findTribe: (id: number) => Tribe | null;
  kill: (person: Person, cause: DeathCause, account?: DeathAccount | null) => void;
  livingWithin: (x: number, z: number, radius: number) => Person[];
  membersOf: (tribe: Tribe) => Person[];
  quarryUses: Map<number, number>;
  tribes: () => readonly Tribe[];
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
  people: PeopleDirectory;
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
