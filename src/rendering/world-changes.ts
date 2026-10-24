import type { WorldMirror } from "../game/world-mirror.ts";
import type { CellRegion, RowRun } from "../world/change-tracking.ts";

export interface WorldChanges {
  readonly groundRuns: readonly RowRun[];
  readonly hasWaterChanged: boolean;
  readonly heightRegion: CellRegion | null;
  readonly surfaceRuns: readonly RowRun[];
  readonly vegetationIndices: readonly number[];
  readonly waterLevelRegion: CellRegion | null;
}

export class WorldChangeReader {
  readonly #mirror: WorldMirror;
  #waterVersion: number;

  constructor(mirror: WorldMirror) {
    this.#mirror = mirror;
    this.#waterVersion = mirror.waterVersion;
  }

  take(): WorldChanges {
    const mirror = this.#mirror;

    const hasWaterChanged = mirror.waterVersion !== this.#waterVersion;

    this.#waterVersion = mirror.waterVersion;

    return {
      groundRuns: mirror.groundChanges.takeRuns(),
      hasWaterChanged,
      heightRegion: mirror.heightChanges.takeRegion(),
      surfaceRuns: mirror.surfaceChanges.takeRuns(),
      vegetationIndices: mirror.vegetation.takeChangedIndices(),
      waterLevelRegion: mirror.waterLevelChanges.takeRegion(),
    };
  }
}
