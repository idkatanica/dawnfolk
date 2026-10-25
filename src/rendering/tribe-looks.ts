import { Color } from "three/webgpu";
import { MaterialSlot, SLOT_COLOR_TABLE } from "../models/materials.ts";
import type { TribeLook } from "../models/people/appearance.ts";
import { parseHexColor } from "../shared/color.ts";
import type { TribeSummary } from "../simulation/frame.ts";

interface KnownTribe {
  readonly accent: Color;
  readonly look: TribeLook;
}

const NEUTRAL_LOOK: TribeLook = { accent: SLOT_COLOR_TABLE[MaterialSlot.Accent], fur: 0x6b_4a_33, id: -1 };

function knownTribeOf(tribe: TribeSummary): KnownTribe {
  const look: TribeLook = { accent: parseHexColor(tribe.color), fur: parseHexColor(tribe.furColor), id: tribe.id };

  return { accent: new Color(look.accent), look };
}

export class TribeLooks {
  readonly #neutral: KnownTribe = { accent: new Color(NEUTRAL_LOOK.accent), look: NEUTRAL_LOOK };
  readonly #tribes = new Map<number, KnownTribe>();

  remember(tribes: readonly TribeSummary[]): void {
    for (const tribe of tribes) {
      if (!this.#tribes.has(tribe.id)) {
        this.#tribes.set(tribe.id, knownTribeOf(tribe));
      }
    }
  }

  look(tribeId: number): TribeLook {
    return this.#known(tribeId).look;
  }

  accent(tribeId: number): Color {
    return this.#known(tribeId).accent;
  }

  #known(tribeId: number): KnownTribe {
    const tribe = this.#tribes.get(tribeId);

    return tribe === undefined ? this.#neutral : tribe;
  }
}
