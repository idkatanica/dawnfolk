import { ANIMALS, type AnimalKind, animalsAt } from "../../content/animals.ts";
import type { WorldRules } from "../../content/world-rules.ts";
import { clamp, distanceSquared, FULL_TURN } from "../../shared/math.ts";
import type { RandomSource } from "../../shared/random.ts";
import type { AnimalPose } from "../../world/agent-poses.ts";
import { createMover, hasArrived, type Mover, moveAlong, setDestination, stopMoving } from "../agents/movement.ts";
import { aroundPoint, type NavigationGrid, type Waypoint } from "../agents/navigation.ts";
import type { IdentifierSource } from "../identifiers.ts";
import type { WorldState } from "../world/world-state.ts";

const HERD_SPREAD = 30;
const BURNING_GROUND = 0.25;
const FIRE_DAMAGE_PER_SECOND = 0.5;
const FEAR_DECAY_PER_SECOND = 0.12;
const CALM_FEAR = 0.1;
const FLEE_DISTANCE = 120;
const FLEE_REPLAN_SECONDS = 2.5;
const FIRE_AWARENESS = 60;
const WANDER_DISTANCE_TO_FOLLOW = 35;
const CORPSE_SECONDS = 30;
const EDGE_MARGIN = 4;
const SPRING_BIRTHS_PER_DAY = 0.6;
const YOUTH_DECAY_PER_DAY = 0.5;
const PASTURE_ATTEMPTS = 8;
const ANY_BIOME_ATTEMPT = 6;
const ESCAPE_TURNS: readonly number[] = [0, -0.6, 0.6, -1.1, 1.1];

type AnimalDeathCause = "blast" | "fire" | "hunt" | "lightning";

export interface Animal {
  appearanceSeed: number;
  causeOfDeath: AnimalDeathCause | null;
  deathSeconds: number;
  fear: number;
  fleeFromX: number;
  fleeFromZ: number;
  health: number;
  herdId: number;
  id: number;
  isAlive: boolean;
  kind: AnimalKind;
  mover: Mover;
  offsetX: number;
  offsetZ: number;
  phase: number;
  pose: AnimalPose;
  poseSeconds: number;
  speed: number;
  threatCheckSeconds: number;
  youth: number;
}

interface Herd {
  goalX: number;
  goalZ: number;
  id: number;
  kind: AnimalKind;
  memberIds: number[];
  retargetSeconds: number;
}

export interface FaunaThreats {
  dangerNear: (x: number, z: number, radius: number) => Waypoint | null;
  hunterNear: (x: number, z: number, radius: number) => Waypoint | null;
}

export interface FaunaTick {
  days: number;
  random: RandomSource;
  rules: WorldRules;
  season: number;
  seconds: number;
  threats: FaunaThreats;
}

export class FaunaSystem {
  readonly #identifiers: IdentifierSource;
  readonly #navigation: NavigationGrid;
  readonly #world: WorldState;
  #animals: Animal[] = [];
  #herds: Herd[] = [];

  constructor(world: WorldState, navigation: NavigationGrid, identifiers: IdentifierSource) {
    this.#world = world;
    this.#navigation = navigation;
    this.#identifiers = identifiers;
  }

  get animals(): readonly Animal[] {
    return this.#animals;
  }

  get herds(): readonly Herd[] {
    return this.#herds;
  }

  get livingCount(): number {
    return this.#animals.filter((animal) => animal.isAlive).length;
  }

  findAnimal(id: number): Animal | null {
    const animal = this.#animals.find((candidate) => candidate.id === id);

    if (animal === undefined) {
      return null;
    }

    return animal;
  }

  spawnHerd(kind: AnimalKind, x: number, z: number, size: number, random: RandomSource): Herd | null {
    if (!this.#navigation.isPassable(x, z)) {
      return null;
    }

    const herd: Herd = { goalX: x, goalZ: z, id: this.#identifiers.next(), kind, memberIds: [], retargetSeconds: 0 };

    for (let member = 0; member < size; member += 1) {
      this.#addAnimal(herd, x + random.signed() * 15, z + random.signed() * 15, random);
    }

    this.#herds.push(herd);

    return herd;
  }

  populate(herdCount: number, random: RandomSource): number {
    const { halfSize } = this.#world.grid;

    let created = 0;

    for (let attempt = 0; attempt < herdCount * 60 && created < herdCount; attempt += 1) {
      const x = random.signed() * halfSize * 0.9;
      const z = random.signed() * halfSize * 0.9;

      const kind = this.#suitableKind(x, z, random);

      if (kind !== null) {
        const [smallest, largest] = ANIMALS[kind].herdSizeRange;

        this.spawnHerd(kind, x, z, random.integer(smallest, largest + 1), random);
        created += 1;
      }
    }

    return created;
  }

  nearestAnimal(x: number, z: number, maximumDistance: number, accepts: (animal: Animal) => boolean): Animal | null {
    let nearest: Animal | null = null;
    let nearestDistance = maximumDistance * maximumDistance;

    for (const animal of this.#animals) {
      const squaredDistance = distanceSquared(animal.mover.x, animal.mover.z, x, z);

      if (animal.isAlive && squaredDistance < nearestDistance && accepts(animal)) {
        nearest = animal;
        nearestDistance = squaredDistance;
      }
    }

    return nearest;
  }

  scare(x: number, z: number, radius: number, strength: number): void {
    for (const animal of this.#animalsWithin(x, z, radius)) {
      startleAnimal(animal, x, z, strength);
    }
  }

  damageArea(x: number, z: number, radius: number, damage: number, cause: AnimalDeathCause): void {
    for (const animal of this.#animalsWithin(x, z, radius)) {
      const distance = Math.hypot(animal.mover.x - x, animal.mover.z - z);

      animal.health -= damage * (1 - distance / radius);

      if (animal.health <= 0) {
        this.kill(animal, cause);
      }
    }
  }

  kill(animal: Animal, cause: AnimalDeathCause): void {
    if (!animal.isAlive) {
      return;
    }

    animal.isAlive = false;
    animal.causeOfDeath = cause;
    animal.pose = "dead";
    animal.speed = 0;
    stopMoving(animal.mover);

    const herd = this.#herds.find((candidate) => candidate.id === animal.herdId);

    if (herd !== undefined) {
      herd.memberIds = herd.memberIds.filter((memberId) => memberId !== animal.id);
    }
  }

  update(tick: FaunaTick): void {
    for (const herd of this.#herds) {
      this.#steerHerd(herd, tick);
    }

    for (const animal of this.#animals) {
      this.#updateAnimal(animal, tick);
    }

    this.#breed(tick);
    this.#removeRemains(tick.seconds);
  }

  #addAnimal(herd: Herd, x: number, z: number, random: RandomSource): Animal {
    const start = this.#spawnPoint(herd, x, z);

    const animal: Animal = {
      appearanceSeed: random.next(),
      causeOfDeath: null,
      deathSeconds: 0,
      fear: 0,
      fleeFromX: 0,
      fleeFromZ: 0,
      health: ANIMALS[herd.kind].health,
      herdId: herd.id,
      id: this.#identifiers.next(),
      isAlive: true,
      kind: herd.kind,
      mover: createMover(start.x, start.z, random.next() * FULL_TURN),
      offsetX: random.signed() * HERD_SPREAD * 0.5,
      offsetZ: random.signed() * HERD_SPREAD * 0.5,
      phase: random.next() * 10,
      pose: "graze",
      poseSeconds: random.next() * 5,
      speed: 0,
      threatCheckSeconds: random.next(),
      youth: 0,
    };

    herd.memberIds.push(animal.id);
    this.#animals.push(animal);

    return animal;
  }

  #firstMember(herd: Herd): Animal | null {
    const [firstId] = herd.memberIds;

    return this.findAnimal(firstId);
  }

  #spawnPoint(herd: Herd, x: number, z: number): Waypoint {
    if (this.#navigation.isPassable(x, z)) {
      return { x, z };
    }

    return { x: herd.goalX, z: herd.goalZ };
  }

  #suitableKind(x: number, z: number, random: RandomSource): AnimalKind | null {
    const cell = this.#world.grid.cellAt(x, z);

    if (cell < 0 || !this.#navigation.isPassable(x, z)) {
      return null;
    }

    return kindForBiome(this.#world.terrain.biome[cell], random);
  }

  #animalsWithin(x: number, z: number, radius: number): Animal[] {
    return this.#animals.filter(
      (animal) => animal.isAlive && Math.hypot(animal.mover.x - x, animal.mover.z - z) < radius
    );
  }

  #steerHerd(herd: Herd, tick: FaunaTick): void {
    herd.retargetSeconds -= tick.seconds;

    const leader = this.#firstMember(herd);

    if (herd.retargetSeconds > 0 || leader === null) {
      return;
    }

    herd.retargetSeconds = tick.random.between(25, 65);

    const pasture = this.#findPasture(herd.kind, leader.mover, tick.random);

    if (pasture !== null) {
      herd.goalX = pasture.x;
      herd.goalZ = pasture.z;
    }
  }

  #findPasture(kind: AnimalKind, from: Waypoint, random: RandomSource): Waypoint | null {
    const { pastureRange, seeksHighGround } = ANIMALS[kind];

    let best: Waypoint | null = null;

    for (let attempt = 0; attempt < PASTURE_ATTEMPTS; attempt += 1) {
      const angle = random.next() * FULL_TURN;
      const distance = random.between(pastureRange[0], pastureRange[1]);

      const pasture = aroundPoint(from, distance, angle);

      if (!this.#isOpenPasture(pasture.x, pasture.z, kind, attempt >= ANY_BIOME_ATTEMPT)) {
        continue;
      }

      if (!seeksHighGround) {
        return pasture;
      }

      if (best === null || this.#groundHeight(pasture) > this.#groundHeight(best)) {
        best = pasture;
      }
    }

    return best;
  }

  #groundHeight(point: Waypoint): number {
    const cell = this.#world.grid.cellAt(point.x, point.z);

    if (cell < 0) {
      return Number.NEGATIVE_INFINITY;
    }

    return this.#world.terrain.height[cell];
  }

  #escapeFrom(animal: Animal): Waypoint {
    const { mover } = animal;

    const awayX = mover.x - animal.fleeFromX;
    const awayZ = mover.z - animal.fleeFromZ;

    const away = Math.atan2(awayZ, awayX);

    if (!ANIMALS[animal.kind].seeksHighGround) {
      return aroundPoint(mover, FLEE_DISTANCE, away);
    }

    let best = aroundPoint(mover, FLEE_DISTANCE, away);
    let bestHeight = Number.NEGATIVE_INFINITY;

    for (const turn of ESCAPE_TURNS) {
      const candidate = aroundPoint(mover, FLEE_DISTANCE, away + turn);

      const height = this.#groundHeight(candidate);

      if (this.#navigation.isPassable(candidate.x, candidate.z) && height > bestHeight) {
        best = candidate;
        bestHeight = height;
      }
    }

    return best;
  }

  #isOpenPasture(x: number, z: number, kind: AnimalKind, acceptsAnyBiome: boolean): boolean {
    const world = this.#world;

    const cell = world.grid.cellAt(x, z);

    if (!this.#navigation.isPassable(x, z) || world.isBurning(cell)) {
      return false;
    }

    return acceptsAnyBiome || isFavouriteBiome(kind, world.terrain.biome[cell]);
  }

  #updateAnimal(animal: Animal, tick: FaunaTick): void {
    if (!animal.isAlive) {
      animal.deathSeconds += tick.seconds;

      return;
    }

    animal.youth = Math.max(0, animal.youth - tick.days * YOUTH_DECAY_PER_DAY);
    this.#sufferFire(animal, tick);

    if (!animal.isAlive) {
      return;
    }

    this.#lookForThreats(animal, tick);

    if (animal.fear > CALM_FEAR) {
      this.#flee(animal, tick);
    } else {
      this.#graze(animal, tick);
    }

    animal.phase += tick.seconds * animal.speed * phaseRate(animal.kind);
    this.#keepOnIsland(animal);
  }

  #sufferFire(animal: Animal, tick: FaunaTick): void {
    const cell = this.#world.grid.cellAt(animal.mover.x, animal.mover.z);

    if (cell < 0 || this.#world.fields.fire[cell] <= BURNING_GROUND) {
      return;
    }

    animal.health -= FIRE_DAMAGE_PER_SECOND * tick.seconds;
    startleAnimal(
      animal,
      animal.mover.x - Math.sin(animal.mover.heading) * 5,
      animal.mover.z - Math.cos(animal.mover.heading) * 5,
      1
    );

    if (animal.health <= 0) {
      this.kill(animal, "fire");
    }
  }

  #lookForThreats(animal: Animal, tick: FaunaTick): void {
    animal.threatCheckSeconds -= tick.seconds;

    if (animal.threatCheckSeconds > 0) {
      return;
    }

    animal.threatCheckSeconds = tick.random.between(0.6, 1.2);

    const { x, z } = animal.mover;

    const fire = tick.threats.dangerNear(x, z, FIRE_AWARENESS);
    const hunter = tick.threats.hunterNear(x, z, ANIMALS[animal.kind].fleeDistance);

    if (fire !== null) {
      startleAnimal(animal, fire.x, fire.z, 1);
    }

    if (hunter !== null) {
      startleAnimal(animal, hunter.x, hunter.z, 0.8);
    }
  }

  #flee(animal: Animal, tick: FaunaTick): void {
    const { mover } = animal;

    animal.fear -= tick.seconds * FEAR_DECAY_PER_SECOND;
    animal.poseSeconds -= tick.seconds;

    if (animal.pose !== "run" || animal.poseSeconds <= 0) {
      setDestination(mover, this.#escapeFrom(animal), this.#navigation, { mayPlanRoute: false });
      animal.pose = "run";
      animal.poseSeconds = FLEE_REPLAN_SECONDS;
    }

    animal.speed = ANIMALS[animal.kind].runSpeed;

    if (moveAlong(mover, tick.seconds, animal.speed, this.#world, this.#navigation)) {
      animal.poseSeconds = 0;
    }
  }

  #graze(animal: Animal, tick: FaunaTick): void {
    const herd = this.#herds.find((candidate) => candidate.id === animal.herdId);

    animal.poseSeconds -= tick.seconds;

    if (animal.pose === "run") {
      animal.pose = "graze";
    }

    if (herd === undefined || animal.pose === "graze") {
      this.#keepGrazing(animal, herd, tick);

      return;
    }

    animal.speed = ANIMALS[animal.kind].walkSpeed;

    if (moveAlong(animal.mover, tick.seconds, animal.speed, this.#world, this.#navigation)) {
      animal.pose = "graze";
      animal.poseSeconds = tick.random.between(4, 12);
    }
  }

  #keepGrazing(animal: Animal, herd: Herd | undefined, tick: FaunaTick): void {
    animal.speed = 0;
    stopMoving(animal.mover);

    if (herd === undefined || animal.poseSeconds > 0) {
      return;
    }

    const targetX = herd.goalX + animal.offsetX;
    const targetZ = herd.goalZ + animal.offsetZ;

    if (Math.hypot(targetX - animal.mover.x, targetZ - animal.mover.z) <= WANDER_DISTANCE_TO_FOLLOW) {
      animal.poseSeconds = tick.random.between(3, 9);

      return;
    }

    setDestination(animal.mover, { x: targetX, z: targetZ }, this.#navigation);
    animal.pose = hasArrived(animal.mover) ? "graze" : "walk";
  }

  #keepOnIsland(animal: Animal): void {
    const limit = this.#world.grid.halfSize - EDGE_MARGIN;

    animal.mover.x = clamp(animal.mover.x, -limit, limit);
    animal.mover.z = clamp(animal.mover.z, -limit, limit);
  }

  #breed(tick: FaunaTick): void {
    if (tick.season < 0.2 || tick.season >= 1.2) {
      return;
    }

    const chance = tick.days * SPRING_BIRTHS_PER_DAY * tick.rules.nature.animalBirthRate;

    for (const herd of this.#herds) {
      this.#tryCalving(herd, chance, tick.random);
    }
  }

  #tryCalving(herd: Herd, chance: number, random: RandomSource): void {
    const mother = this.#firstMember(herd);

    if (mother === null || herd.memberIds.length >= ANIMALS[herd.kind].maximumHerdSize) {
      return;
    }

    if (!random.chance(chance)) {
      return;
    }

    const calf = this.#addAnimal(herd, mother.mover.x + 2, mother.mover.z + 2, random);

    calf.youth = 1;
  }

  #removeRemains(seconds: number): void {
    const hasExpired = this.#animals.some(
      (animal) => !animal.isAlive && animal.deathSeconds + seconds > CORPSE_SECONDS
    );

    if (!hasExpired) {
      return;
    }

    this.#animals = this.#animals.filter((animal) => animal.isAlive || animal.deathSeconds <= CORPSE_SECONDS);
    this.#herds = this.#herds.filter((herd) => herd.memberIds.length > 0);
  }
}

export function startleAnimal(animal: Animal, fromX: number, fromZ: number, strength: number): void {
  animal.fear = Math.max(animal.fear, strength);
  animal.fleeFromX = fromX;
  animal.fleeFromZ = fromZ;
}

function kindForBiome(biome: number, random: RandomSource): AnimalKind | null {
  const kinds = animalsAt(biome);

  const total = kinds.reduce((sum, kind) => sum + ANIMALS[kind].abundance, 0);

  let remaining = random.next() * total;

  for (const kind of kinds) {
    remaining -= ANIMALS[kind].abundance;

    if (remaining < 0) {
      return kind;
    }
  }

  return null;
}

function isFavouriteBiome(kind: AnimalKind, biome: number): boolean {
  return ANIMALS[kind].favouriteBiomes.some((favourite) => favourite === biome);
}

function phaseRate(kind: AnimalKind): number {
  if (kind === "mammoth") {
    return 0.55;
  }

  return 1;
}
