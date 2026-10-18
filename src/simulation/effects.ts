type BlessingStyle = "abundance" | "healing" | "inspiration";

export interface BlessingEffect {
  kind: "blessing";
  radius: number;
  style: BlessingStyle;
  x: number;
  z: number;
}

export interface EarthquakeEffect {
  kind: "earthquake";
  magnitude: number;
  radius: number;
  x: number;
  z: number;
}

export interface EmberEffect {
  durationSeconds: number;
  fromX: number;
  fromZ: number;
  kind: "ember";
  toX: number;
  toZ: number;
}

export interface ExplosionEffect {
  isInWater: boolean;
  kind: "explosion";
  power: number;
  radius: number;
  x: number;
  z: number;
}

export interface LightningEffect {
  isNatural: boolean;
  kind: "lightning";
  x: number;
  z: number;
}

export interface MeteorEffect {
  durationSeconds: number;
  fromX: number;
  fromY: number;
  fromZ: number;
  kind: "meteor";
  radius: number;
  toX: number;
  toZ: number;
}

export type SimulationEffect =
  | BlessingEffect
  | EarthquakeEffect
  | EmberEffect
  | ExplosionEffect
  | LightningEffect
  | MeteorEffect;

export class EffectLog {
  #effects: SimulationEffect[] = [];

  add(effect: SimulationEffect): void {
    this.#effects.push(effect);
  }

  takeEffects(): SimulationEffect[] {
    const effects = this.#effects;

    this.#effects = [];

    return effects;
  }
}
