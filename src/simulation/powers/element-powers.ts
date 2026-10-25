import { FULL_TURN } from "../../shared/math.ts";
import type { RandomSource } from "../../shared/random.ts";
import { cellsInArea } from "../world/terrain-editing.ts";
import { SNOW_CAPACITY } from "../world/world-state.ts";
import { explode, shakeLand, strikeLightning } from "./catastrophes.ts";
import { APPLIED, type PowerHandler, percent } from "./power-handler.ts";

const FIRE_BRUSH_STRENGTH = 0.75;
const FIRE_EDGE_FADE = 0.6;
const RAIN_PER_SECOND = 1.2;
const RAIN_DEFAULT_INTENSITY = 0.7;
const SNOW_PER_SECOND = 0.6;
const SNOW_DEFAULT_INTENSITY = 0.6;
const DEFAULT_BLAST_POWER = 0.8;
const METEOR_DISTANCE = 2600;
const METEOR_ALTITUDE = 3200;
const METEOR_REFERENCE_CRATER = 140;
const METEOR_POWER = 2.4;
const DEFAULT_MAGNITUDE = 0.7;

function strikeDistance(strike: number, scatter: number, random: RandomSource): number {
  if (strike === 0) {
    return 0;
  }

  return random.next() * scatter;
}

export const firePower: PowerHandler<"fire"> = (target, parameters, services) => {
  const strength = percent(parameters.intensity) * FIRE_BRUSH_STRENGTH;

  for (const { cell, distance } of cellsInArea(services.world, { ...target, radius: parameters.radius })) {
    services.fire.ignite(cell, strength * (1 - (distance / parameters.radius) * FIRE_EDGE_FADE));
  }

  return APPLIED;
};

export const lightningPower: PowerHandler<"lightning"> = (target, parameters, services) => {
  const { random } = services;

  for (let strike = 0; strike < parameters.strikes; strike += 1) {
    const angle = random.next() * FULL_TURN;
    const distance = strikeDistance(strike, parameters.scatter, random);

    strikeLightning(
      {
        ignitionChance: percent(parameters.ignitionChance),
        isNatural: false,
        x: target.x + Math.cos(angle) * distance,
        z: target.z + Math.sin(angle) * distance,
      },
      services
    );
  }

  return APPLIED;
};

export const rainPower: PowerHandler<"rain"> = (target, parameters, services) => {
  const { fire, rules, world } = services;

  const intensity = percent(parameters.intensity) / RAIN_DEFAULT_INTENSITY;

  const soaking = target.seconds * RAIN_PER_SECOND * intensity * rules.water.rainStrength;

  for (const { cell, distance } of cellsInArea(world, { ...target, radius: parameters.radius })) {
    const relativeDistance = distance / parameters.radius;

    const falloff = 1 - relativeDistance * relativeDistance;

    world.fields.wetness[cell] = Math.min(1, world.fields.wetness[cell] + soaking * falloff);
    fire.douse(cell, soaking * 2 * falloff);
    world.markSurfaceCell(cell);
  }

  return APPLIED;
};

export const snowPower: PowerHandler<"snow"> = (target, parameters, services) => {
  const { fire, rules, world } = services;

  const intensity = percent(parameters.intensity) / SNOW_DEFAULT_INTENSITY;

  const snowfall = target.seconds * SNOW_PER_SECOND * intensity * rules.water.snowfall;

  for (const { cell, distance } of cellsInArea(world, { ...target, radius: parameters.radius })) {
    if (world.isWater(cell)) {
      continue;
    }

    const relativeDistance = distance / parameters.radius;

    const falloff = 1 - relativeDistance * relativeDistance;

    world.fields.snow[cell] = Math.min(SNOW_CAPACITY, world.fields.snow[cell] + snowfall * falloff);
    fire.douse(cell, snowfall * 3);
    world.markSurfaceCell(cell);
  }

  return APPLIED;
};

export const explosionPower: PowerHandler<"explosion"> = (target, parameters, services) => {
  explode(
    {
      burnsDebris: parameters.burningDebris,
      catastrophe: "explosion",
      power: percent(parameters.power) / DEFAULT_BLAST_POWER,
      radius: parameters.radius,
      x: target.x,
      z: target.z,
    },
    services
  );

  return APPLIED;
};

export const meteorPower: PowerHandler<"meteor"> = (target, parameters, services) => {
  const { environment, random, world } = services;

  const fromWindward = Math.atan2(environment.windZ, environment.windX) + Math.PI + random.signed() * 0.45;
  const ground = world.surfaceAt(target.x, target.z);

  services.effects.add({
    durationSeconds: parameters.fallTime,
    fromX: target.x + Math.cos(fromWindward) * METEOR_DISTANCE,
    fromY: ground + METEOR_ALTITUDE,
    fromZ: target.z + Math.sin(fromWindward) * METEOR_DISTANCE,
    kind: "meteor",
    radius: parameters.craterRadius,
    toX: target.x,
    toZ: target.z,
  });
  services.schedule(parameters.fallTime, () => {
    explode(
      {
        burnsDebris: parameters.ignites,
        catastrophe: "meteor",
        power: METEOR_POWER * (parameters.craterRadius / METEOR_REFERENCE_CRATER),
        radius: parameters.craterRadius,
        x: target.x,
        z: target.z,
      },
      services
    );
  });

  return APPLIED;
};

export const earthquakePower: PowerHandler<"earthquake"> = (target, parameters, services) => {
  shakeLand(
    {
      magnitude: percent(parameters.magnitude) / DEFAULT_MAGNITUDE,
      radius: parameters.radius,
      x: target.x,
      z: target.z,
    },
    services
  );

  return APPLIED;
};
