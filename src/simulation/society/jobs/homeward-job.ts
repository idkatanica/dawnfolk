import type { PersonTick } from "../society-context.ts";
import type { Job } from "./job.ts";
import { MigrateJob } from "./migrate-job.ts";

const ARRIVED_DISTANCE = 60;

export class HomewardJob extends MigrateJob {
  override update(tick: PersonTick): Job | null {
    const next = super.update(tick);

    if (next !== null) {
      return next;
    }

    const { person, tribe } = tick;

    if (Math.hypot(person.mover.x - tribe.campX, person.mover.z - tribe.campZ) > ARRIVED_DISTANCE) {
      person.strandedDay = tick.context.environment.day;
    }

    return null;
  }
}
