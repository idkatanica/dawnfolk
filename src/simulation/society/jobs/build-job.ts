import { BUILDINGS } from "../../../content/buildings.ts";
import { faceTowards } from "../../agents/movement.ts";
import { type Building, isComplete } from "../buildings.ts";
import { completeConstruction } from "../construction.ts";
import { walkSpeed } from "../person.ts";
import type { PersonTick } from "../society-context.ts";
import { workSpeed } from "../tools.ts";
import { headTo, type Job, standStill, walk } from "./job.ts";

type BuildPhase = "travel" | "work";

const EXPEDITION_DISTANCE = 220;

export class BuildJob implements Job {
  readonly isExpedition: boolean;
  readonly kind = "build";
  readonly #siteId: number;
  #phase: BuildPhase = "travel";

  constructor(tick: PersonTick, site: Building) {
    const { random } = tick.context;

    this.isExpedition = Math.hypot(site.x - tick.tribe.campX, site.z - tick.tribe.campZ) > EXPEDITION_DISTANCE;
    this.#siteId = site.id;
    headTo(tick.person, { x: site.x + random.signed() * 3, z: site.z + random.between(4, 6) }, tick.context);
  }

  update(tick: PersonTick): Job | null {
    const site = tick.context.buildings.find(this.#siteId);

    if (site === null || isComplete(site)) {
      return null;
    }

    if (this.#phase === "travel") {
      this.#travel(tick);

      return this;
    }

    standStill(tick.person, "build");
    faceTowards(tick.person.mover, site.x, site.z);
    site.progress = Math.min(1, site.progress + (tick.seconds * workSpeed(tick.tribe)) / BUILDINGS[site.kind].work);

    if (!isComplete(site)) {
      return this;
    }

    completeConstruction(tick.tribe, site, tick.context);

    return null;
  }

  #travel(tick: PersonTick): void {
    if (walk(tick, walkSpeed(tick.person))) {
      this.#phase = "work";
    }
  }
}
