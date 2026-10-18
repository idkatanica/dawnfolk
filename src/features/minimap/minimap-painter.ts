import type { EngineHandle } from "../../game/engine-handle.ts";
import { paintMinimapTerrain } from "../../rendering/minimap-image.ts";
import { clamp } from "../../shared/math.ts";

const TERRAIN_REFRESH_MILLISECONDS = 1000;
const SEASON_STEP = 0.05;
const OVERLAY_INTERVAL_MILLISECONDS = 100;
const REFERENCE_SIZE = 176;
const FIRE_COLOR = "rgb(230 82 40)";
const VIEW_FILL = "rgb(255 255 255 / 0.32)";
const VIEW_OUTLINE = "rgb(255 255 255 / 0.9)";
const VIEW_HALF_ANGLE = 0.45;

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

  #drawTribes(context: CanvasRenderingContext2D, size: number): void {
    const scale = size / REFERENCE_SIZE;

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
    const { distance, targetX, targetZ, yaw } = this.#engine.camera.state;
    const { grid } = this.#engine.session.mirror;

    const [x, y] = this.#toMap(targetX, targetZ, size);
    const reach = clamp((distance / grid.worldSize) * size * 0.8, 6, size * 0.45);
    const facing = Math.atan2(-Math.cos(yaw), -Math.sin(yaw));

    context.beginPath();
    context.moveTo(x, y);
    context.arc(x, y, reach, facing - VIEW_HALF_ANGLE, facing + VIEW_HALF_ANGLE);
    context.closePath();
    context.fillStyle = VIEW_FILL;
    context.fill();
    context.lineWidth = 1.5 * (size / REFERENCE_SIZE);
    context.strokeStyle = VIEW_OUTLINE;
    context.stroke();
  }
}
