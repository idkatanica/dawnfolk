import { type PerspectiveCamera, Vector3 } from "three/webgpu";
import { FIGURE_SCALE } from "../../models/people/human-proportions.ts";
import type { Selection } from "../../simulation/commands.ts";
import type { SimulationFrame } from "../../simulation/frame.ts";
import { ANIMAL_STRIDE, AnimalField, PERSON_STRIDE, PersonField } from "../../world/agent-buffers.ts";
import type { HeightField, ScreenPoint, ViewportSize } from "./ground-picker.ts";
import { normalizedToPixels, projectToNormalized } from "./screen-projection.ts";

const PICK_RADIUS_PIXELS = 26;
const PERSON_CENTER_HEIGHT = 0.9 * FIGURE_SCALE;
const BUILDING_PICK_RADIUS_PIXELS = 40;
const SMALLEST_OCCLUSION_MARGIN = 12;
const OCCLUSION_MARGIN_PER_METER = 0.04;

interface Candidate {
  readonly distance: number;
  readonly reach: number;
  readonly selection: Selection;
}

interface ScreenHit {
  readonly distance: number;
  readonly reach: number;
}

export class EntityPicker {
  readonly #camera: PerspectiveCamera;
  readonly #heightAt: HeightField;
  readonly #point = new Vector3();
  readonly #projected = new Vector3();

  constructor(camera: PerspectiveCamera, heightAt: HeightField) {
    this.#camera = camera;
    this.#heightAt = heightAt;
  }

  pick(frame: SimulationFrame, screen: ScreenPoint, viewport: ViewportSize, ground: Vector3 | null): Selection | null {
    const candidates = [
      ...this.#people(frame, screen, viewport),
      ...this.#animals(frame, screen, viewport),
      ...this.#buildings(frame, screen, viewport),
    ];

    const visibleReach = this.#visibleReach(ground);

    const [nearest] = candidates
      .filter((candidate) => candidate.reach <= visibleReach)
      .toSorted((first, second) => first.distance - second.distance);

    if (nearest !== undefined) {
      return nearest.selection;
    }

    if (ground === null) {
      return null;
    }

    return { kind: "cell", x: ground.x, z: ground.z };
  }

  #people(frame: SimulationFrame, screen: ScreenPoint, viewport: ViewportSize): Candidate[] {
    const candidates: Candidate[] = [];

    for (let person = 0; person < frame.personCount; person += 1) {
      const offset = person * PERSON_STRIDE;

      const x = frame.people[offset + PersonField.X];
      const z = frame.people[offset + PersonField.Z];

      const hit = this.#screenHit(x, PERSON_CENTER_HEIGHT, z, screen, viewport);

      if (hit.distance < PICK_RADIUS_PIXELS) {
        candidates.push({ ...hit, selection: { id: frame.people[offset + PersonField.Id], kind: "person" } });
      }
    }

    return candidates;
  }

  #animals(frame: SimulationFrame, screen: ScreenPoint, viewport: ViewportSize): Candidate[] {
    const candidates: Candidate[] = [];

    for (let animal = 0; animal < frame.animalCount; animal += 1) {
      const offset = animal * ANIMAL_STRIDE;

      const x = frame.animals[offset + AnimalField.X];
      const z = frame.animals[offset + AnimalField.Z];

      const hit = this.#screenHit(x, 1.2, z, screen, viewport);

      if (hit.distance < PICK_RADIUS_PIXELS) {
        candidates.push({ ...hit, selection: { id: frame.animals[offset + AnimalField.Id], kind: "animal" } });
      }
    }

    return candidates;
  }

  #buildings(frame: SimulationFrame, screen: ScreenPoint, viewport: ViewportSize): Candidate[] {
    const candidates: Candidate[] = [];

    for (const building of frame.buildings) {
      const hit = this.#screenHit(building.x, 1.5, building.z, screen, viewport);

      if (hit.distance < BUILDING_PICK_RADIUS_PIXELS) {
        candidates.push({
          distance: hit.distance + 8,
          reach: hit.reach,
          selection: { id: building.id, kind: "building" },
        });
      }
    }

    return candidates;
  }

  #visibleReach(ground: Vector3 | null): number {
    if (ground === null) {
      return Number.POSITIVE_INFINITY;
    }

    const reach = this.#camera.position.distanceTo(ground);

    return reach + Math.max(SMALLEST_OCCLUSION_MARGIN, reach * OCCLUSION_MARGIN_PER_METER);
  }

  #screenHit(x: number, lift: number, z: number, screen: ScreenPoint, viewport: ViewportSize): ScreenHit {
    const point = this.#point.set(x, this.#heightAt(x, z) + lift, z);

    const reach = this.#camera.position.distanceTo(point);
    const projected = projectToNormalized(this.#camera, point.x, point.y, point.z, this.#projected);

    if (projected === null) {
      return { distance: Number.POSITIVE_INFINITY, reach };
    }

    const pixels = normalizedToPixels(projected, viewport);

    return { distance: Math.hypot(pixels.x - screen.x, pixels.y - screen.y), reach };
  }
}
