import { abs, clamp, cos, dot, ivec2, min, sin, smoothstep, step, textureLoad, vec2 } from "three/tsl";
import { type DataTexture, type Node, RedFormat, RGBAFormat } from "three/webgpu";
import { distanceToSegment } from "../../shared/math.ts";
import type { Spring } from "../../world/water.ts";
import type { WorldGrid } from "../../world/world-grid.ts";
import { floatDataTexture } from "../data-textures.ts";

const MOUTH_MARGIN = 2.5;
const CHANNEL_DEPTH = 1.2;
const INSIDE_REACH = 6;
const STRAIGHT_REACH = 3;
const BLEND_REACH = 16;
const SIDE_CLEARANCE = 2;
const SIDE_REACH = 5;
const SHELTER_REACH = 3;
const LARGEST_CAVE_COUNT = 255;

export interface CaveOutlet {
  readonly depth: Node<"float">;
  readonly direction: Node<"vec2">;
  readonly share: Node<"float">;
  readonly shelter: Node<"float">;
}

interface OutletFrame {
  readonly across: Node<"float">;
  readonly along: Node<"float">;
}

function isCave(spring: Spring): boolean {
  return spring.kind === "cave";
}

function channelDepth(frame: OutletFrame, halfWidth: Node<"float">): Node<"float"> {
  return min(min(halfWidth.sub(abs(frame.across)), frame.along.add(INSIDE_REACH)), CHANNEL_DEPTH);
}

function outletShare(frame: OutletFrame, halfWidth: Node<"float">): Node<"float"> {
  const along = smoothstep(BLEND_REACH, STRAIGHT_REACH, frame.along);
  const across = smoothstep(halfWidth.add(SIDE_REACH), halfWidth.add(SIDE_CLEARANCE), abs(frame.across));

  return along.mul(across);
}

export function caveMouthWidth(spring: Spring): number {
  return spring.radius * 2 + MOUTH_MARGIN;
}

export class CaveOutlets {
  readonly cells: DataTexture;
  readonly mouths: DataTexture;
  readonly #cellData: Float32Array;
  readonly #grid: WorldGrid;
  readonly #mouthData: Float32Array;

  constructor(grid: WorldGrid, springs: readonly Spring[]) {
    this.#grid = grid;
    this.#cellData = new Float32Array(grid.cellCount);
    this.#mouthData = new Float32Array((LARGEST_CAVE_COUNT + 1) * 4);
    this.cells = floatDataTexture(this.#cellData, grid.cellsPerSide, grid.cellsPerSide, RedFormat);
    this.mouths = floatDataTexture(this.#mouthData, LARGEST_CAVE_COUNT + 1, 1, RGBAFormat);
    this.rebuild(springs);
  }

  rebuild(springs: readonly Spring[]): void {
    const grid = this.#grid;
    const caves = springs.filter(isCave).slice(0, LARGEST_CAVE_COUNT);

    this.#cellData.fill(0);
    this.#mouthData.fill(0);

    for (const [index, cave] of caves.entries()) {
      const slot = index + 1;
      const reach = cave.radius + SIDE_REACH + grid.cellSize * Math.SQRT1_2;

      const back: [number, number] = [cave.x - cave.directionX * INSIDE_REACH, cave.z - cave.directionZ * INSIDE_REACH];
      const front: [number, number] = [cave.x + cave.directionX * BLEND_REACH, cave.z + cave.directionZ * BLEND_REACH];

      this.#mouthData.set([cave.x, cave.z, Math.atan2(cave.directionZ, cave.directionX), cave.radius], slot * 4);

      for (const cell of grid.cellsInRadius(cave.x, cave.z, BLEND_REACH + reach)) {
        if (distanceToSegment(grid.cellCenterX(cell), grid.cellCenterZ(cell), back, front) <= reach) {
          this.#cellData[cell] = slot;
        }
      }
    }

    this.cells.needsUpdate = true;
    this.mouths.needsUpdate = true;
  }

  outletAt(point: Node<"vec2">): CaveOutlet {
    const grid = this.#grid;
    const last = grid.cellsPerSide - 1;

    const cell = clamp(point.add(grid.halfSize).div(grid.cellSize).floor(), vec2(0, 0), vec2(last, last));
    const slot = textureLoad(this.cells, ivec2(cell)).x;
    const mouth = textureLoad(this.mouths, ivec2(vec2(slot.add(0.5).floor(), 0)));

    const direction = vec2(cos(mouth.z), sin(mouth.z));
    const offset = point.sub(mouth.xy);
    const halfWidth = mouth.w;

    const frame: OutletFrame = {
      across: offset.y.mul(direction.x).sub(offset.x.mul(direction.y)),
      along: dot(offset, direction),
    };

    const share = outletShare(frame, halfWidth).mul(step(0.5, slot));

    return {
      depth: channelDepth(frame, halfWidth),
      direction,
      share,
      shelter: smoothstep(0, -SHELTER_REACH, frame.along).mul(share),
    };
  }

  dispose(): void {
    this.cells.dispose();
    this.mouths.dispose();
  }
}
