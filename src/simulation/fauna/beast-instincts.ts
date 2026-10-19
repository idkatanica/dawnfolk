import { ANIMALS } from "../../content/animals.ts";
import { isWinter } from "../../content/seasons.ts";
import { clamp } from "../../shared/math.ts";
import type { RandomSource } from "../../shared/random.ts";
import { faceTowards, moveAlong, setDestination, stopMoving } from "../agents/movement.ts";
import type { NavigationGrid, Waypoint } from "../agents/navigation.ts";
import type { WorldState } from "../world/world-state.ts";
import type { Animal, FaunaTick } from "./fauna.ts";

export interface Quarry {
  readonly companions: number;
  readonly frailty: number;
  readonly id: number;
  readonly isSheltered: boolean;
  readonly x: number;
  readonly z: number;
}

export type BlowKind = "bite" | "gore" | "trample";

export interface BeastBlow {
  readonly attacker: Animal;
  readonly damage: number;
  readonly isFirst: boolean;
  readonly kind: BlowKind;
}

export interface Assailant {
  readonly id: number;
  readonly x: number;
  readonly z: number;
}

export interface PeopleSense {
  findQuarry: (x: number, z: number, radius: number) => Quarry | null;
  locate: (id: number) => Quarry | null;
  nearest: (x: number, z: number, radius: number) => Quarry | null;
  wound: (id: number, blow: BeastBlow) => void;
}

export interface Pack {
  goalX: number;
  goalZ: number;
  readonly id: number;
  readonly kind: Animal["kind"];
  readonly memberIds: readonly number[];
}

export interface PackHunt {
  hasDrawnBlood: boolean;
  readonly preyId: number;
  seconds: number;
  readonly startingSize: number;
}

interface PackMood {
  checkSeconds: number;
  hunger: number;
  hunt: PackHunt | null;
  restDays: number;
}

interface Charge {
  readonly blow: BlowKind;
  hasStruck: boolean;
  seconds: number;
  readonly targetId: number;
}

interface Strike {
  cooldownSeconds: number;
  retargetSeconds: number;
}

const SCENT_RADIUS = 300;
const PROWL_RADIUS = 3500;
const PROWL_HUNGER = 0.55;
const PROWL_STAND_OFF = 90;
const HUNT_CHECK_SECONDS = 3;
const HUNT_CHANCE = 0.9;
const HUNGER_PER_DAY = 0.7;
const LONGEST_HUNT_SECONDS = 60;
const REST_AFTER_FEAST_DAYS = 2;
const REST_AFTER_FAILURE_DAYS = 1;
const HURT_SHARE = 0.55;
const LONE_COMPANIONS = 1;
const GROUP_COMPANIONS = 3;
const BITE_REACH = 1.7;
const BITE_CHANCE = 0.62;
const BITE_DAMAGE: readonly [number, number] = [0.12, 0.19];
const BITE_SECONDS: readonly [number, number] = [0.9, 1.4];
const RETARGET_SECONDS = 0.5;
const FLINCH_SECONDS = 0.45;
const FALL_SECONDS = 1.3;
const STALKING_SPEED_SHARE = 0.85;
const CHARGE_SECONDS = 7;
const CHARGE_GIVE_UP_DISTANCE = 50;
const CHARGE_SPEED_SHARE = 1.2;
const MAMMOTH_REACH = 3.4;
const STAG_REACH = 1.8;
const TRAMPLE_DAMAGE: readonly [number, number] = [0.38, 0.55];
const GORE_DAMAGE: readonly [number, number] = [0.14, 0.24];
const MAMMOTH_CHARGE_CHANCE = 0.5;
const BULL_CHARGE_CHANCE = 0.45;
const HERD_GUARD_RADIUS = 45;
const STAG_NOTICE_RADIUS = 5;
const STAG_CHANCE = 0.4;
const CORNERED_SECONDS = 0.3;
const ADULT_YOUTH = 0.3;
const CALM_FEAR = 0.1;

function nightFactor(hours: number): number {
  if (hours >= 20 || hours < 5.5) {
    return 1;
  }

  if (hours >= 17.5 || hours < 7.5) {
    return 0.6;
  }

  return 0.25;
}

function between(random: RandomSource, range: readonly [number, number]): number {
  return random.between(range[0], range[1]);
}

export function packBoldness(hunger: number, packSize: number, tick: FaunaTick): number {
  const winter = isWinter(tick.season) ? 2 : 1;
  const strength = clamp(packSize / 4, 0.4, 1.2);

  return tick.rules.nature.beastBoldness * nightFactor(tick.hours) * winter * hunger * strength;
}

export class BeastInstincts {
  readonly #charges = new Map<number, Charge>();
  readonly #flinches = new Map<number, number>();
  readonly #moods = new Map<number, PackMood>();
  readonly #navigation: NavigationGrid;
  readonly #random: RandomSource;
  readonly #strikes = new Map<number, Strike>();
  readonly #world: WorldState;

  constructor(world: WorldState, navigation: NavigationGrid, random: RandomSource) {
    this.#world = world;
    this.#navigation = navigation;
    this.#random = random;
  }

  huntOf(packId: number): PackHunt | null {
    const mood = this.#moods.get(packId);

    if (mood === undefined) {
      return null;
    }

    return mood.hunt;
  }

  isCharging(animal: Animal): boolean {
    return this.#charges.has(animal.id);
  }

  steerPacks(packs: readonly Pack[], findAnimal: (id: number) => Animal | null, tick: FaunaTick): void {
    for (const pack of packs) {
      if (pack.kind !== "wolf") {
        continue;
      }

      const members = pack.memberIds.map((id) => findAnimal(id)).filter((animal) => animal !== null);

      this.#steerPack(pack, members, tick);
    }

    this.#updateFlinches(tick.seconds);
  }

  watchCornered(animal: Animal, tick: FaunaTick): void {
    const isGrazer = animal.kind === "deer" || animal.kind === "ibex";

    if (!isGrazer || animal.youth > ADULT_YOUTH || animal.fear <= CALM_FEAR || this.#charges.has(animal.id)) {
      return;
    }

    if (animal.mover.stuckSeconds < CORNERED_SECONDS) {
      return;
    }

    const person = tick.threats.people.nearest(animal.mover.x, animal.mover.z, STAG_NOTICE_RADIUS);

    if (person === null) {
      return;
    }

    if (this.#random.chance(STAG_CHANCE * tick.rules.nature.beastBoldness)) {
      this.#charges.set(animal.id, { blow: "gore", hasStruck: false, seconds: 0, targetId: person.id });
    }
  }

  isEngaged(animal: Animal, packHunt: PackHunt | null): boolean {
    return this.#charges.has(animal.id) || this.#flinches.has(animal.id) || packHunt !== null;
  }

  act(animal: Animal, packHunt: PackHunt | null, tick: FaunaTick): void {
    if (this.#flinches.has(animal.id)) {
      this.#holdStill(animal, "flinch");

      return;
    }

    const charge = this.#charges.get(animal.id);

    if (charge !== undefined) {
      this.#charge(animal, charge, tick);

      return;
    }

    if (packHunt !== null) {
      this.#hunt(animal, packHunt, tick);
    }
  }

  provoke(animal: Animal, assailant: Assailant, herdMates: readonly Animal[], boldness: number): void {
    if (animal.kind !== "mammoth" || !animal.isAlive || this.#charges.has(animal.id)) {
      return;
    }

    if (this.#random.chance(MAMMOTH_CHARGE_CHANCE * boldness)) {
      this.#startCharge(animal, assailant.id, "trample");

      return;
    }

    const bull = this.#herdBull(animal, herdMates);

    if (bull !== null && this.#random.chance(BULL_CHARGE_CHANCE * boldness)) {
      this.#startCharge(bull, assailant.id, "trample");
    }
  }

  flinch(animal: Animal): void {
    this.#flinches.set(animal.id, FLINCH_SECONDS);
  }

  isHurt(animal: Animal): boolean {
    return animal.health < ANIMALS[animal.kind].health * HURT_SHARE;
  }

  forget(animal: Animal): void {
    this.#charges.delete(animal.id);
    this.#flinches.delete(animal.id);
    this.#strikes.delete(animal.id);
  }

  abandonHunt(packId: number, members: readonly Animal[], from: Waypoint): void {
    const mood = this.#moods.get(packId);

    if (mood === undefined || mood.hunt === null) {
      return;
    }

    mood.hunt = null;
    mood.restDays = REST_AFTER_FAILURE_DAYS;
    scatter(members, from);
  }

  fallSeconds(): number {
    return FALL_SECONDS;
  }

  #steerPack(pack: Pack, members: readonly Animal[], tick: FaunaTick): void {
    const mood = this.#moodOf(pack.id);

    mood.hunger = Math.min(1, mood.hunger + tick.days * HUNGER_PER_DAY);
    mood.restDays -= tick.days;

    if (mood.hunt !== null) {
      this.#followHunt(mood, mood.hunt, members, tick);

      return;
    }

    mood.checkSeconds -= tick.seconds;

    if (mood.checkSeconds > 0 || mood.restDays > 0) {
      return;
    }

    mood.checkSeconds = HUNT_CHECK_SECONDS;
    this.#considerHunt(mood, members, tick);
    this.#prowl(pack, mood, members, tick);
  }

  #prowl(pack: Pack, mood: PackMood, members: readonly Animal[], tick: FaunaTick): void {
    const [leader] = members;

    const isTame = tick.rules.nature.beastBoldness <= 0;

    if (leader === undefined || mood.hunt !== null || mood.hunger < PROWL_HUNGER || isTame) {
      return;
    }

    const scent = tick.threats.people.nearest(leader.mover.x, leader.mover.z, PROWL_RADIUS);

    if (scent === null) {
      return;
    }

    const awayX = leader.mover.x - scent.x;
    const awayZ = leader.mover.z - scent.z;
    const distance = Math.max(1, Math.hypot(awayX, awayZ));

    pack.goalX = scent.x + (awayX / distance) * PROWL_STAND_OFF;
    pack.goalZ = scent.z + (awayZ / distance) * PROWL_STAND_OFF;
  }

  #considerHunt(mood: PackMood, members: readonly Animal[], tick: FaunaTick): void {
    const [leader] = members;

    if (leader === undefined || members.some((member) => this.isHurt(member))) {
      return;
    }

    const quarry = tick.threats.people.findQuarry(leader.mover.x, leader.mover.z, SCENT_RADIUS);

    if (quarry === null || quarry.isSheltered || quarry.companions > LONE_COMPANIONS) {
      return;
    }

    const boldness = packBoldness(mood.hunger, members.length, tick);

    if (!this.#random.chance(clamp(boldness * quarry.frailty * HUNT_CHANCE, 0, 0.9))) {
      return;
    }

    mood.hunt = { hasDrawnBlood: false, preyId: quarry.id, seconds: 0, startingSize: members.length };
  }

  #followHunt(mood: PackMood, hunt: PackHunt, members: readonly Animal[], tick: FaunaTick): void {
    hunt.seconds += tick.seconds;

    const prey = tick.threats.people.locate(hunt.preyId);

    if (prey === null) {
      mood.hunt = null;
      mood.hunger = hunt.hasDrawnBlood ? 0 : mood.hunger;
      mood.restDays = hunt.hasDrawnBlood ? REST_AFTER_FEAST_DAYS : REST_AFTER_FAILURE_DAYS;

      return;
    }

    const isBroken = members.length < hunt.startingSize || members.some((member) => this.isHurt(member));

    const isGuarded = prey.isSheltered || prey.companions >= GROUP_COMPANIONS;

    if (isGuarded || isBroken || hunt.seconds > LONGEST_HUNT_SECONDS) {
      mood.hunt = null;
      mood.restDays = REST_AFTER_FAILURE_DAYS;
      scatter(members, prey);
    }
  }

  #hunt(animal: Animal, hunt: PackHunt, tick: FaunaTick): void {
    const prey = tick.threats.people.locate(hunt.preyId);

    if (prey === null) {
      return;
    }

    const distance = Math.hypot(prey.x - animal.mover.x, prey.z - animal.mover.z);
    const strike = this.#strikeOf(animal);

    if (distance > BITE_REACH) {
      this.#runAt(animal, prey, strike, ANIMALS.wolf.runSpeed * STALKING_SPEED_SHARE, tick);

      return;
    }

    this.#holdStill(animal, "attack");
    faceTowards(animal.mover, prey.x, prey.z);
    strike.cooldownSeconds -= tick.seconds;

    if (strike.cooldownSeconds > 0) {
      return;
    }

    strike.cooldownSeconds = between(this.#random, BITE_SECONDS);

    if (!this.#random.chance(BITE_CHANCE)) {
      return;
    }

    const isFirst = !hunt.hasDrawnBlood;

    hunt.hasDrawnBlood = true;
    tick.threats.people.wound(prey.id, {
      attacker: animal,
      damage: between(this.#random, BITE_DAMAGE),
      isFirst,
      kind: "bite",
    });
  }

  #charge(animal: Animal, charge: Charge, tick: FaunaTick): void {
    charge.seconds += tick.seconds;

    const target = tick.threats.people.locate(charge.targetId);
    const reach = animal.kind === "mammoth" ? MAMMOTH_REACH : STAG_REACH;

    if (target === null || charge.hasStruck || charge.seconds > CHARGE_SECONDS) {
      this.#endCharge(animal, target);

      return;
    }

    const distance = Math.hypot(target.x - animal.mover.x, target.z - animal.mover.z);

    if (distance > CHARGE_GIVE_UP_DISTANCE) {
      this.#endCharge(animal, target);

      return;
    }

    if (distance > reach) {
      this.#runAt(animal, target, this.#strikeOf(animal), ANIMALS[animal.kind].runSpeed * CHARGE_SPEED_SHARE, tick);
      animal.pose = "charge";

      return;
    }

    charge.hasStruck = true;
    this.#holdStill(animal, "attack");
    faceTowards(animal.mover, target.x, target.z);
    tick.threats.people.wound(target.id, {
      attacker: animal,
      damage: between(this.#random, charge.blow === "trample" ? TRAMPLE_DAMAGE : GORE_DAMAGE),
      isFirst: true,
      kind: charge.blow,
    });
  }

  #endCharge(animal: Animal, from: Waypoint | null): void {
    this.#charges.delete(animal.id);
    this.#strikes.delete(animal.id);

    if (from !== null) {
      scatter([animal], from);
    }
  }

  #startCharge(animal: Animal, targetId: number, blow: BlowKind): void {
    this.#charges.set(animal.id, { blow, hasStruck: false, seconds: 0, targetId });
  }

  #herdBull(wounded: Animal, herdMates: readonly Animal[]): Animal | null {
    let bull: Animal | null = null;

    for (const mate of herdMates) {
      const isAdult = mate.isAlive && mate.youth <= ADULT_YOUTH && mate !== wounded;
      const isNear = Math.hypot(mate.mover.x - wounded.mover.x, mate.mover.z - wounded.mover.z) < HERD_GUARD_RADIUS;

      if (isAdult && isNear && (bull === null || mate.health > bull.health)) {
        bull = mate;
      }
    }

    return bull;
  }

  #runAt(animal: Animal, target: Waypoint, strike: Strike, speed: number, tick: FaunaTick): void {
    strike.retargetSeconds -= tick.seconds;

    if (strike.retargetSeconds <= 0) {
      strike.retargetSeconds = RETARGET_SECONDS;
      setDestination(animal.mover, target, this.#navigation, { arrivalDistance: BITE_REACH * 0.6 });
    }

    animal.pose = "charge";
    animal.speed = speed;
    moveAlong(animal.mover, tick.seconds, speed, this.#world, this.#navigation);
  }

  #holdStill(animal: Animal, pose: Animal["pose"]): void {
    animal.pose = pose;
    animal.speed = 0;
    stopMoving(animal.mover);
  }

  #strikeOf(animal: Animal): Strike {
    const existing = this.#strikes.get(animal.id);

    if (existing !== undefined) {
      return existing;
    }

    const strike: Strike = { cooldownSeconds: this.#random.between(0.2, 0.8), retargetSeconds: 0 };

    this.#strikes.set(animal.id, strike);

    return strike;
  }

  #moodOf(packId: number): PackMood {
    const existing = this.#moods.get(packId);

    if (existing !== undefined) {
      return existing;
    }

    const mood: PackMood = {
      checkSeconds: this.#random.next() * HUNT_CHECK_SECONDS,
      hunger: 0.5,
      hunt: null,
      restDays: 0,
    };

    this.#moods.set(packId, mood);

    return mood;
  }

  #updateFlinches(seconds: number): void {
    for (const [id, remaining] of this.#flinches) {
      if (remaining - seconds <= 0) {
        this.#flinches.delete(id);
      } else {
        this.#flinches.set(id, remaining - seconds);
      }
    }
  }
}

export function scatter(animals: readonly Animal[], from: Waypoint): void {
  for (const animal of animals) {
    animal.fear = 1;
    animal.fleeFromX = from.x;
    animal.fleeFromZ = from.z;
  }
}
