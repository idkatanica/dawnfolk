import { clamp, FULL_TURN } from "../../shared/math.ts";
import type { Waypoint } from "../agents/navigation.ts";
import { discover } from "../society/tribe-life.ts";
import { carveCrater, cellsInArea, shakeTerrain } from "../world/terrain-editing.ts";
import type { PowerServices } from "./power-handler.ts";

const STRIKE_RADIUS = 20;
const STRIKE_INTENSITY = 0.65;
const STRIKE_SCORCH = 0.5;
const STRIKE_KILL_RADIUS = 14;
const STRIKE_BUILDING_RADIUS = 18;
const STRIKE_SCARE_RADIUS = 200;
const TEACHING_DISTANCE = 300;
const SOAKED = 0.5;
const CRATER_CORE = 0.85;
const DEBRIS_REACH = 1.9;
const DEBRIS_CLEARING = 1.45;
const DEBRIS_IGNITION = 1.35;
const BLAST_REACH = 1.8;
const NATURAL_STRIKE_ATTEMPTS = 6;
const HIGH_GROUND = 700;
const TALL_FOREST = 1;
const ISLAND_MARGIN = 60;

export interface Strike {
  ignitionChance: number;
  isNatural: boolean;
  x: number;
  z: number;
}

export function strikeLightning(strike: Strike, services: PowerServices): void {
  const { buildings, fauna, fire, society, world } = services;

  services.effects.add({ isNatural: strike.isNatural, kind: "lightning", x: strike.x, z: strike.z });

  for (const { cell } of cellsInArea(world, { radius: STRIKE_RADIUS, x: strike.x, z: strike.z })) {
    if (catchesFire(cell, strike, services)) {
      fire.ignite(cell, STRIKE_INTENSITY);
    }

    world.fields.scorch[cell] = Math.max(world.fields.scorch[cell], STRIKE_SCORCH);
    world.markSurfaceCell(cell);
  }

  society.damageArea(strike.x, strike.z, STRIKE_KILL_RADIUS, 3, "lightning");
  fauna.damageArea(strike.x, strike.z, STRIKE_KILL_RADIUS, 6, "lightning");
  fauna.scare(strike.x, strike.z, STRIKE_SCARE_RADIUS, 1);

  for (const building of buildings.all) {
    if (Math.hypot(building.x - strike.x, building.z - strike.z) < STRIKE_BUILDING_RADIUS) {
      buildings.setAlight(building);
    }
  }

  teachFire(strike, services);
}

function catchesFire(cell: number, strike: Strike, services: PowerServices): boolean {
  if (isRainedOn(cell, strike, services)) {
    return false;
  }

  return services.random.chance(strike.ignitionChance);
}

function isRainedOn(cell: number, strike: Strike, services: PowerServices): boolean {
  if (!strike.isNatural || services.world.fields.wetness[cell] <= SOAKED) {
    return false;
  }

  return services.random.chance(services.environment.precipitation);
}

function teachFire(strike: Strike, services: PowerServices): void {
  const tribe = services.society.nearestTribe(strike.x, strike.z, TEACHING_DISTANCE);

  if (tribe === null) {
    return;
  }

  discover(tribe, "fire", `${tribe.name} saw lightning strike and kept the flame`, services);
}

export function naturalStrikeSite(focus: Waypoint, services: PowerServices): Waypoint | null {
  const { random, world } = services;

  const limit = world.grid.halfSize - ISLAND_MARGIN;

  for (let attempt = 0; attempt < NATURAL_STRIKE_ATTEMPTS; attempt += 1) {
    const angle = random.next() * FULL_TURN;
    const distance = random.between(300, 2500);

    const x = clamp(focus.x + Math.cos(angle) * distance, -limit, limit);
    const z = clamp(focus.z + Math.sin(angle) * distance, -limit, limit);

    if (isStrikeSite(world.grid.cellAt(x, z), attempt >= 4, services)) {
      return { x, z };
    }
  }

  return null;
}

function isStrikeSite(cell: number, acceptsAnyLand: boolean, services: PowerServices): boolean {
  const { world } = services;

  if (cell < 0 || world.isWater(cell)) {
    return false;
  }

  return acceptsAnyLand || world.terrain.height[cell] > HIGH_GROUND || world.canopyFuel[cell] > TALL_FOREST;
}

export interface Blast {
  burnsDebris: boolean;
  power: number;
  radius: number;
  x: number;
  z: number;
}

export function explode(blast: Blast, services: PowerServices): void {
  const { buildings, fauna, hazards, society, world } = services;
  const reach = blast.radius * BLAST_REACH;

  const isInWater = world.isWaterAt(blast.x, blast.z);

  carveCrater(world, blast, blast.radius * 0.3 * (blast.power > 1.5 ? 1.25 : 1));
  scatterDebris(blast, isInWater, services);
  buildings.damageArea(blast.x, blast.z, reach, 120 * blast.power, blast.burnsDebris);
  society.damageArea(blast.x, blast.z, reach, 1.6 * blast.power, "blast");
  fauna.damageArea(blast.x, blast.z, reach, 3 * blast.power, "blast");
  fauna.scare(blast.x, blast.z, blast.radius * 8, 1);
  hazards.addZone({ radius: blast.radius * 4, remainingSeconds: 6, x: blast.x, z: blast.z });
  services.effects.add({
    isInWater,
    kind: "explosion",
    power: blast.power,
    radius: blast.radius,
    x: blast.x,
    z: blast.z,
  });
}

function scatterDebris(blast: Blast, isInWater: boolean, services: PowerServices): void {
  const { world } = services;

  for (const { cell, distance } of cellsInArea(world, { ...blast, radius: blast.radius * DEBRIS_REACH })) {
    const relativeDistance = distance / blast.radius;

    world.markSurfaceCell(cell);

    if (relativeDistance < CRATER_CORE) {
      vaporize(cell, services);
    } else {
      showerWithDebris(cell, relativeDistance, blast.burnsDebris && !isInWater, services);
    }
  }
}

function showerWithDebris(cell: number, relativeDistance: number, canIgnite: boolean, services: PowerServices): void {
  const { fire } = services;
  const { fields } = services.world;
  const falloff = DEBRIS_REACH - relativeDistance;

  if (relativeDistance < DEBRIS_CLEARING) {
    clearSomePlants(cell, services);
  }

  if (canIgnite && relativeDistance < DEBRIS_IGNITION) {
    fire.ignite(cell, 0.5);
  }

  fire.addHeat(cell, 0.35 * falloff);
  fields.scorch[cell] = Math.max(fields.scorch[cell], 0.3 * falloff);
  fields.snow[cell] *= 0.3;
}

function clearSomePlants(cell: number, services: PowerServices): void {
  if (services.random.chance(0.55)) {
    services.world.clearPlants(cell, false);
  }
}

function vaporize(cell: number, services: PowerServices): void {
  const { fields } = services.world;

  fields.fire[cell] = 0;
  fields.heat[cell] = 0;
  fields.fuel[cell] = 0;
  fields.scorch[cell] = 1;
  fields.wetness[cell] = 0;
  fields.snow[cell] = 0;
  services.world.clearPlants(cell, true);
}

export interface Quake {
  magnitude: number;
  radius: number;
  x: number;
  z: number;
}

export function shakeLand(quake: Quake, services: PowerServices): void {
  const { buildings, fauna, hazards, random, society, world } = services;

  shakeTerrain(world, quake, quake.magnitude, random);

  for (const { cell, distance } of cellsInArea(world, quake)) {
    if (random.chance(0.08 * (1 - distance / quake.radius) * quake.magnitude)) {
      world.clearPlants(cell, false);
    }
  }

  buildings.damageArea(quake.x, quake.z, quake.radius, 45 * quake.magnitude, false);
  society.damageArea(quake.x, quake.z, quake.radius * 0.6, 0.35 * quake.magnitude, "earthquake");
  fauna.scare(quake.x, quake.z, quake.radius * 1.5, 1);
  hazards.addZone({ radius: quake.radius, remainingSeconds: 5, x: quake.x, z: quake.z });
  services.effects.add({
    kind: "earthquake",
    magnitude: quake.magnitude,
    radius: quake.radius,
    x: quake.x,
    z: quake.z,
  });
}
