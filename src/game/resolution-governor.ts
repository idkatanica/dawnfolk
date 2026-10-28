const SLOW_FRAME_MILLISECONDS = 22;
const SMOOTH_FRAME_MILLISECONDS = 18;
const FRAME_SMOOTHING = 0.08;
const LOWEST_SCALE = 0.5;
const LOWEST_PIXEL_RATIO = 0.75;
const SCALE_STEP = 0.85;
const SETTLE_MILLISECONDS = 1500;
const RECOVERY_MILLISECONDS = 6000;
const LONGEST_MEASURED_FRAME = 250;

export class ResolutionGovernor {
  readonly #highestRatio: number;
  #averageFrame = SMOOTH_FRAME_MILLISECONDS;
  #scale = 1;
  #sinceChange = 0;

  constructor(highestRatio: number) {
    this.#highestRatio = highestRatio;
  }

  pixelRatio(devicePixelRatio: number): number {
    const sharpest = Math.min(devicePixelRatio, this.#highestRatio);

    return Math.min(sharpest, Math.max(LOWEST_PIXEL_RATIO, sharpest * this.#scale));
  }

  record(elapsed: number, hasFocus: boolean): boolean {
    if (!hasFocus || elapsed <= 0 || elapsed > LONGEST_MEASURED_FRAME) {
      return false;
    }

    this.#averageFrame += (elapsed - this.#averageFrame) * FRAME_SMOOTHING;
    this.#sinceChange += elapsed;

    if (this.#sinceChange < SETTLE_MILLISECONDS) {
      return false;
    }

    if (this.#averageFrame > SLOW_FRAME_MILLISECONDS && this.#scale > LOWEST_SCALE) {
      return this.#change(Math.max(LOWEST_SCALE, this.#scale * SCALE_STEP));
    }

    const isSteady = this.#averageFrame < SMOOTH_FRAME_MILLISECONDS && this.#sinceChange >= RECOVERY_MILLISECONDS;

    if (isSteady && this.#scale < 1) {
      return this.#change(Math.min(1, this.#scale / SCALE_STEP));
    }

    return false;
  }

  #change(scale: number): boolean {
    this.#scale = scale;
    this.#sinceChange = 0;
    this.#averageFrame = SMOOTH_FRAME_MILLISECONDS;

    return true;
  }
}
