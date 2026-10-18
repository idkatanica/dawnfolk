import type { RandomSource } from "../../shared/random.ts";
import type { WorldState } from "../world/world-state.ts";

const EMBER_DRAG = 0.35;
const GLOWING_CHANCE = 0.6;
const LATERAL_SCATTER = 8;

export interface Ember {
  durationSeconds: number;
  fromX: number;
  fromZ: number;
  isGlowing: boolean;
  remainingSeconds: number;
  toX: number;
  toZ: number;
}

interface EmberWind {
  strength: number;
  x: number;
  z: number;
}

export class EmberSystem {
  readonly #embers: Ember[] = [];
  readonly #world: WorldState;

  constructor(world: WorldState) {
    this.#world = world;
  }

  get flying(): readonly Ember[] {
    return this.#embers;
  }

  launch(cell: number, wind: EmberWind, random: RandomSource): Ember {
    const { grid } = this.#world;

    const durationSeconds = random.between(2, 5);
    const speed = random.between(14, 40) * (0.4 + wind.strength);
    const scatter = random.signed() * LATERAL_SCATTER;

    const fromX = grid.cellCenterX(cell);
    const fromZ = grid.cellCenterZ(cell);
    const reach = (speed * (1 - Math.exp(-EMBER_DRAG * durationSeconds))) / EMBER_DRAG;

    const ember: Ember = {
      durationSeconds,
      fromX,
      fromZ,
      isGlowing: random.chance(GLOWING_CHANCE),
      remainingSeconds: durationSeconds,
      toX: fromX + wind.x * reach - wind.z * scatter,
      toZ: fromZ + wind.z * reach + wind.x * scatter,
    };

    this.#embers.push(ember);

    return ember;
  }

  update(seconds: number, onLanding: (ember: Ember) => void): void {
    let kept = 0;

    for (const ember of this.#embers) {
      ember.remainingSeconds -= seconds;

      if (ember.remainingSeconds <= 0) {
        onLanding(ember);
      } else {
        this.#embers[kept] = ember;
        kept += 1;
      }
    }

    this.#embers.length = kept;
  }
}
