import { personName, tribeIdentity } from "../../content/names.ts";
import type { TechnologyId } from "../../content/technologies.ts";
import type { RandomSource } from "../../shared/random.ts";
import { isStranded, stopMoving } from "../agents/movement.ts";
import type { Waypoint } from "../agents/navigation.ts";
import { nearestWalkableSpot } from "../agents/walkable-ground.ts";
import type { Chronicle } from "../chronicle.ts";
import type { IdentifierSource } from "../identifiers.ts";
import type { BuildingSystem } from "./buildings.ts";
import { handleBuildingLoss } from "./construction.ts";
import { dropJob, updateMind } from "./decisions.ts";
import { walk } from "./jobs/job.ts";
import { updateNeeds } from "./needs.ts";
import { createPerson, type DeathCause, type Person, walkSpeed } from "./person.ts";
import { findCampSite } from "./settlement.ts";
import type { PeopleDirectory, PersonTick, SocietyContext } from "./society-context.ts";
import { createTribe, type Tribe } from "./tribe.ts";
import { type SocietyServices, updateTribe } from "./tribe-life.ts";

const CORPSE_SECONDS = 40;
const ARRIVAL_SEARCH_RADIUS = 260;
const ARRIVAL_SPREAD = 16;
const POSE_PHASE_RATE = 1.9;

const DEATH_MESSAGES: Readonly<Record<DeathCause, string>> = {
  age: "died of old age",
  blast: "was killed by a blast",
  cold: "froze to death",
  earthquake: "was crushed in an earthquake",
  fire: "died in the flames",
  hunger: "starved",
  lightning: "was struck by lightning",
  mammoth: "was trampled by a mammoth",
};

interface SocietyDependencies {
  buildings: BuildingSystem;
  chronicle: Chronicle;
  identifiers: IdentifierSource;
}

interface TribeArrival {
  context: SocietyContext;
  people: number;
  technologies: readonly TechnologyId[];
  x: number;
  z: number;
}

export class SocietySystem implements PeopleDirectory, SocietyServices {
  readonly quarryUses = new Map<number, number>();
  readonly #dependencies: SocietyDependencies;
  readonly #tribesById = new Map<number, Tribe>();
  #deaths = 0;
  #people: Person[] = [];
  #tribeNumber = 0;
  #tribes: Tribe[] = [];

  constructor(dependencies: SocietyDependencies) {
    this.#dependencies = dependencies;
  }

  get deaths(): number {
    return this.#deaths;
  }

  get people(): readonly Person[] {
    return this.#people;
  }

  get population(): number {
    return this.#people.filter((person) => person.isAlive).length;
  }

  tribes(): readonly Tribe[] {
    return this.#tribes;
  }

  findPerson(id: number): Person | null {
    const person = this.#people.find((candidate) => candidate.id === id);

    if (person === undefined) {
      return null;
    }

    return person;
  }

  findTribe(id: number): Tribe | null {
    const tribe = this.#tribesById.get(id);

    if (tribe === undefined) {
      return null;
    }

    return tribe;
  }

  membersOf(tribe: Tribe): Person[] {
    return this.#people.filter((person) => person.isAlive && person.tribeId === tribe.id);
  }

  createTribe(campX: number, campZ: number): Tribe {
    const tribe = createTribe({
      campX,
      campZ,
      day: this.#dependencies.chronicle.day,
      id: this.#dependencies.identifiers.next(),
      identity: tribeIdentity(this.#tribeNumber),
    });

    this.#tribeNumber += 1;
    this.#tribes.push(tribe);
    this.#tribesById.set(tribe.id, tribe);

    return tribe;
  }

  addPerson(tribe: Tribe, person: Person): void {
    person.tribeId = tribe.id;
    tribe.memberIds.push(person.id);
    this.#people.push(person);
  }

  moveToTribe(person: Person, from: Tribe, to: Tribe): void {
    dropJob(from, person);
    from.memberIds = from.memberIds.filter((memberId) => memberId !== person.id);
    to.memberIds.push(person.id);
    person.tribeId = to.id;
    person.homeId = null;
  }

  spawnTribe(arrival: TribeArrival): Tribe | null {
    const { context } = arrival;

    const site = findCampSite(
      {
        excluded: null,
        isNearOrigin: true,
        minimumNeighborDistance: 0,
        origin: { x: arrival.x, z: arrival.z },
        radius: ARRIVAL_SEARCH_RADIUS,
      },
      context,
      this.#tribes
    );

    if (site === null) {
      return null;
    }

    const tribe = this.createTribe(site.x, site.z);

    for (const technology of arrival.technologies) {
      tribe.technologies.add(technology);
    }

    for (let member = 0; member < arrival.people; member += 1) {
      this.addPerson(tribe, this.#newcomer(tribe, site, member, arrival));
    }

    context.chronicle.record({
      category: "arrival",
      text: `${tribe.name} arrived in these lands`,
      tribeId: tribe.id,
      x: site.x,
      z: site.z,
    });

    return tribe;
  }

  kill(person: Person, cause: DeathCause): void {
    if (!person.isAlive) {
      return;
    }

    const tribe = this.findTribe(person.tribeId);

    person.isAlive = false;
    person.causeOfDeath = cause;
    person.pose = "dead";
    person.speed = 0;
    stopMoving(person.mover);
    this.#deaths += 1;

    if (tribe === null) {
      return;
    }

    dropJob(tribe, person);
    tribe.deaths += 1;
    tribe.memberIds = tribe.memberIds.filter((memberId) => memberId !== person.id);
    this.#dependencies.chronicle.record({
      category: cause === "age" ? "death" : "warning",
      text: `${person.name} of ${tribe.name} ${DEATH_MESSAGES[cause]}`,
      tribeId: tribe.id,
      x: person.mover.x,
      z: person.mover.z,
    });

    if (tribe.memberIds.length === 0) {
      this.#dissolve(tribe);
    }
  }

  damageArea(x: number, z: number, radius: number, damage: number, cause: DeathCause): void {
    for (const person of this.livingWithin(x, z, radius)) {
      const distance = Math.hypot(person.mover.x - x, person.mover.z - z);

      person.health -= damage * (1 - distance / radius);

      if (person.health <= 0) {
        this.kill(person, cause);
      }
    }
  }

  livingWithin(x: number, z: number, radius: number): Person[] {
    return this.#people.filter((person) => isLivingWithin(person, x, z, radius));
  }

  countNear(x: number, z: number, radius: number, accepts: (person: Person) => boolean): number {
    let count = 0;

    for (const person of this.#people) {
      if (isLivingWithin(person, x, z, radius) && accepts(person)) {
        count += 1;
      }
    }

    return count;
  }

  nearestPerson(x: number, z: number, radius: number, accepts: (person: Person) => boolean): Person | null {
    let nearest: Person | null = null;
    let nearestDistance = radius;

    for (const person of this.#people) {
      if (!person.isAlive) {
        continue;
      }

      const distance = Math.hypot(person.mover.x - x, person.mover.z - z);

      if (distance < nearestDistance && accepts(person)) {
        nearest = person;
        nearestDistance = distance;
      }
    }

    return nearest;
  }

  nearestTribe(x: number, z: number, radius: number): Tribe | null {
    let nearest: Tribe | null = null;
    let nearestDistance = radius;

    for (const tribe of this.#tribes) {
      const distance = Math.hypot(tribe.campX - x, tribe.campZ - z);

      if (distance < nearestDistance) {
        nearest = tribe;
        nearestDistance = distance;
      }
    }

    return nearest;
  }

  update(seconds: number, days: number, context: SocietyContext): void {
    this.#handleBuildingLosses(context);

    const tribes = [...this.#tribes];
    const members = this.#membersOfEach(tribes);

    for (const [position, tribe] of tribes.entries()) {
      updateTribe({ context, days, members: members[position], seconds, services: this, tribe });
    }

    for (const person of [...this.#people]) {
      this.#updatePerson(person, seconds, days, context);
    }

    this.#removeRemains(seconds);
  }

  #newcomer(tribe: Tribe, site: Waypoint, member: number, arrival: TribeArrival): Person {
    const { random, world } = arrival.context;

    const isFemale = member % 2 === 1;
    const isGrownUp = member < arrival.people - 2;

    const arrivalSpot = { x: site.x + random.signed() * ARRIVAL_SPREAD, z: site.z + random.signed() * ARRIVAL_SPREAD };

    const spot = nearestWalkableSpot(world, arrivalSpot, ARRIVAL_SPREAD * 2);

    return createPerson(
      {
        age: newcomerAge(isGrownUp, random),
        id: this.#dependencies.identifiers.next(),
        isFemale,
        name: personName(random, isFemale),
        tribeId: tribe.id,
        x: spot.x,
        z: spot.z,
      },
      random
    );
  }

  #membersOfEach(tribes: readonly Tribe[]): Person[][] {
    const positions = new Map(tribes.map((tribe, position) => [tribe.id, position]));
    const members = tribes.map((): Person[] => []);

    for (const person of this.#people) {
      const position = positions.get(person.tribeId);

      if (person.isAlive && position !== undefined) {
        members[position].push(person);
      }
    }

    return members;
  }

  #dissolve(tribe: Tribe): void {
    const { buildings, chronicle } = this.#dependencies;

    for (const building of buildings.all.filter((candidate) => candidate.tribeId === tribe.id)) {
      buildings.remove(building, "abandoned");
    }

    this.#tribes = this.#tribes.filter((candidate) => candidate !== tribe);
    this.#tribesById.delete(tribe.id);
    chronicle.record({
      category: "death",
      text: `${tribe.name} is no more`,
      tribeId: tribe.id,
      x: tribe.campX,
      z: tribe.campZ,
    });
  }

  #handleBuildingLosses(context: SocietyContext): void {
    for (const loss of context.buildings.takeLosses()) {
      const tribe = this.findTribe(loss.building.tribeId);

      if (tribe !== null) {
        handleBuildingLoss(tribe, loss, context);
      }
    }
  }

  #updatePerson(person: Person, seconds: number, days: number, context: SocietyContext): void {
    if (!person.isAlive) {
      person.deathSeconds += seconds;

      return;
    }

    const tribe = this.findTribe(person.tribeId);

    if (tribe === null) {
      return;
    }

    const tick: PersonTick = { context, person, seconds, tribe };

    const causeOfDeath = updateNeeds(tick, days);

    if (causeOfDeath !== null) {
      this.kill(person, causeOfDeath);

      return;
    }

    updateMind(tick);

    if (isStranded(person.mover, context.world)) {
      walk(tick, walkSpeed(person));
    } else {
      this.#act(tick);
    }

    person.phase += seconds * person.speed * POSE_PHASE_RATE;
  }

  #act(tick: PersonTick): void {
    const { person } = tick;

    if (person.job === null) {
      return;
    }

    person.job = person.job.update(tick);
  }

  #removeRemains(seconds: number): void {
    const hasExpired = this.#people.some((person) => !person.isAlive && person.deathSeconds + seconds > CORPSE_SECONDS);

    if (!hasExpired) {
      return;
    }

    this.#people = this.#people.filter((person) => person.isAlive || person.deathSeconds <= CORPSE_SECONDS);
  }
}

function isLivingWithin(person: Person, x: number, z: number, radius: number): boolean {
  return person.isAlive && Math.hypot(person.mover.x - x, person.mover.z - z) < radius;
}

function newcomerAge(isGrownUp: boolean, random: RandomSource): number {
  if (isGrownUp) {
    return random.between(17, 35);
  }

  return random.between(4, 11);
}
