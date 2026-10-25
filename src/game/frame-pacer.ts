const IDLE_FRAME_MILLISECONDS = 1000 / 60;
const BACKGROUND_FRAME_MILLISECONDS = 1000 / 30;
const ACTIVE_MILLISECONDS = 1500;
const EARLY_FRAME_MILLISECONDS = 2;

export class FramePacer {
  #lastActivity = Number.NEGATIVE_INFINITY;
  #lastRender = Number.NaN;

  markActivity(now: number): void {
    this.#lastActivity = now;
  }

  isFrameDue(now: number, hasFocus: boolean): boolean {
    if (Number.isNaN(this.#lastRender)) {
      return true;
    }

    return now - this.#lastRender >= this.#interval(now, hasFocus) - EARLY_FRAME_MILLISECONDS;
  }

  markRendered(now: number): number {
    const elapsed = Number.isNaN(this.#lastRender) ? 0 : now - this.#lastRender;

    this.#lastRender = now;

    return elapsed;
  }

  #interval(now: number, hasFocus: boolean): number {
    if (!hasFocus) {
      return BACKGROUND_FRAME_MILLISECONDS;
    }

    if (now - this.#lastActivity < ACTIVE_MILLISECONDS) {
      return 0;
    }

    return IDLE_FRAME_MILLISECONDS;
  }
}
