import type { EngineHandle } from "../../game/engine-handle.ts";
import { MarkerShape, type MarkerShapeCode } from "../../rendering/agents/marker-look.ts";
import { paintMinimapTerrain } from "../../rendering/minimap-image.ts";
import { herdMarks, personMarks } from "../../rendering/minimap-marks.ts";

export const MAP_PIXELS = 176;

const TERRAIN_REFRESH_MILLISECONDS = 1000;
const SEASON_STEP = 0.05;
const OVERLAY_INTERVAL_MILLISECONDS = 100;
const FIRE_COLOR = "rgb(230 82 40)";
const VIEW_FILL = "rgb(255 255 255 / 0.32)";
const VIEW_OUTLINE = "rgb(255 255 255 / 0.9)";
const FOOTPRINT_REACH_IN_WORLDS = 2;
const MARK_OUTLINE = "rgb(255 255 255 / 0.9)";
const TRIANGLE_HALF_WIDTH = Math.sqrt(3) / 2;

const MARK_RADII: Readonly<Record<MarkerShapeCode, number>> = {
  [MarkerShape.Circle]: 1.6,
  [MarkerShape.Diamond]: 2.6,
  [MarkerShape.Triangle]: 2.6,
};

function traceMark(
  context: CanvasRenderingContext2D,
  shape: MarkerShapeCode,
  x: number,
  y: number,
  radius: number
): void {
  context.beginPath();

  if (shape === MarkerShape.Circle) {
    context.arc(x, y, radius, 0, Math.PI * 2);

    return;
  }

  if (shape === MarkerShape.Diamond) {
    context.moveTo(x, y - radius);
    context.lineTo(x + radius, y);
    context.lineTo(x, y + radius);
    context.lineTo(x - radius, y);
    context.closePath();

    return;
  }

  context.moveTo(x, y - radius);
  context.lineTo(x + radius * TRIANGLE_HALF_WIDTH, y + radius / 2);
  context.lineTo(x - radius * TRIANGLE_HALF_WIDTH, y + radius / 2);
  context.closePath();
}

export class MinimapPainter {
  readonly #canvas: HTMLCanvasElement;
  readonly #engine: EngineHandle;
  readonly #terrain: HTMLCanvasElement;
  #frameRequest = 0;
  #lastOverlay = 0;
  #lastTerrain = Number.NEGATIVE_INFINITY;
  #paintedLandVersion = -1;
  #paintedSeason = Number.NEGATIVE_INFINITY;

  constructor(canvas: HTMLCanvasElement, engine: EngineHandle) {
    this.#canvas = canvas;
    this.#engine = engine;
    this.#terrain = document.createElement("canvas");
  }

  start(): void {
    this.#frameRequest = requestAnimationFrame((time) => this.#loop(time));
  }

  stop(): void {
    cancelAnimationFrame(this.#frameRequest);
  }

  #loop(time: number): void {
    this.#draw(time);
    this.#frameRequest = requestAnimationFrame((next) => this.#loop(next));
  }

  #draw(time: number): void {
    if (time - this.#lastOverlay < OVERLAY_INTERVAL_MILLISECONDS) {
      return;
    }

    this.#lastOverlay = time;

    const context = this.#canvas.getContext("2d");

    if (context === null) {
      return;
    }

    const size = this.#canvas.width;

    if (this.#isTerrainStale(time, size)) {
      this.#refreshTerrain(size);
      this.#lastTerrain = time;
    }

    context.clearRect(0, 0, size, size);
    context.drawImage(this.#terrain, 0, 0);
    this.#drawFires(context, size);
    this.#drawAgents(context, size);
    this.#drawTribes(context, size);
    this.#drawView(context, size);
  }

  #isTerrainStale(time: number, size: number): boolean {
    if (this.#terrain.width !== size) {
      return true;
    }

    if (time - this.#lastTerrain < TERRAIN_REFRESH_MILLISECONDS) {
      return false;
    }

    const { mirror } = this.#engine.session;

    const hasLandChanged = mirror.landVersion !== this.#paintedLandVersion;
    const hasSeasonTurned = Math.abs(mirror.frame.calendar.season - this.#paintedSeason) >= SEASON_STEP;

    return hasLandChanged || hasSeasonTurned;
  }

  #refreshTerrain(size: number): void {
    const { mirror } = this.#engine.session;

    this.#paintedLandVersion = mirror.landVersion;
    this.#paintedSeason = mirror.frame.calendar.season;
    this.#terrain.width = size;
    this.#terrain.height = size;

    const context = this.#terrain.getContext("2d");

    if (context !== null) {
      context.putImageData(paintMinimapTerrain(mirror, size), 0, 0);
    }
  }

  #toMap(x: number, z: number, size: number): [number, number] {
    const { grid } = this.#engine.session.mirror;

    return [((x + grid.halfSize) / grid.worldSize) * size, ((z + grid.halfSize) / grid.worldSize) * size];
  }

  #drawFires(context: CanvasRenderingContext2D, size: number): void {
    const { frame, grid } = this.#engine.session.mirror;

    const pixel = Math.max(1.5, size / grid.cellsPerSide);

    context.fillStyle = FIRE_COLOR;

    for (const cell of frame.burningCells) {
      const [x, y] = this.#toMap(grid.cellCenterX(cell), grid.cellCenterZ(cell), size);

      context.fillRect(x - pixel / 2, y - pixel / 2, pixel, pixel);
    }
  }

  #drawAgents(context: CanvasRenderingContext2D, size: number): void {
    const { frame } = this.#engine.session;

    const scale = size / MAP_PIXELS;

    context.lineWidth = scale;
    context.strokeStyle = MARK_OUTLINE;

    for (const mark of [...herdMarks(frame), ...personMarks(frame)]) {
      const [x, y] = this.#toMap(mark.x, mark.z, size);

      traceMark(context, mark.shape, x, y, MARK_RADII[mark.shape] * mark.scale * scale);
      context.fillStyle = mark.color;
      context.fill();
      context.stroke();
    }
  }

  #drawTribes(context: CanvasRenderingContext2D, size: number): void {
    const scale = size / MAP_PIXELS;

    for (const tribe of this.#engine.session.frame.tribes) {
      const [x, y] = this.#toMap(tribe.campX, tribe.campZ, size);

      context.beginPath();
      context.arc(x, y, 4.5 * scale, 0, Math.PI * 2);
      context.fillStyle = tribe.color;
      context.fill();
      context.lineWidth = 1.5 * scale;
      context.strokeStyle = "white";
      context.stroke();
    }
  }

  #drawView(context: CanvasRenderingContext2D, size: number): void {
    const { grid } = this.#engine.session.mirror;

    const footprint = this.#engine.camera.groundFootprint(grid.worldSize * FOOTPRINT_REACH_IN_WORLDS);

    if (footprint.length === 0) {
      return;
    }

    context.beginPath();

    for (const point of footprint) {
      const [x, y] = this.#toMap(point.x, point.z, size);

      context.lineTo(x, y);
    }

    context.closePath();
    context.fillStyle = VIEW_FILL;
    context.fill();
    context.lineWidth = 1.5 * (size / MAP_PIXELS);
    context.strokeStyle = VIEW_OUTLINE;
    context.stroke();
  }
}
