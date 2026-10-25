import { ANIMAL_KINDS } from "../content/animals.ts";
import type { SimulationFrame, TribeSummary } from "../simulation/frame.ts";
import { ANIMAL_STRIDE, AnimalField, PERSON_STRIDE, PersonField } from "../world/agent-buffers.ts";
import { ANIMAL_POSES, PERSON_POSES } from "../world/agent-poses.ts";
import { ANIMAL_MARKERS, herdScale, MarkerShape, type MarkerShapeCode } from "./agents/marker-look.ts";

export interface MinimapMark {
  readonly color: string;
  readonly scale: number;
  readonly shape: MarkerShapeCode;
  readonly x: number;
  readonly z: number;
}

type AnimalBuffer = Pick<SimulationFrame, "animalCount" | "animals">;

interface PersonBuffer extends Pick<SimulationFrame, "people" | "personCount"> {
  readonly tribes: readonly Pick<TribeSummary, "color" | "id">[];
}

interface HerdSum {
  count: number;
  readonly kind: number;
  x: number;
  z: number;
}

function cssColor(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

function sumHerds(frame: AnimalBuffer): Map<number, HerdSum> {
  const { animals } = frame;

  const herds = new Map<number, HerdSum>();

  for (let animal = 0; animal < frame.animalCount; animal += 1) {
    const offset = animal * ANIMAL_STRIDE;

    if (ANIMAL_POSES[animals[offset + AnimalField.Pose]] === "dead") {
      continue;
    }

    const herdId = animals[offset + AnimalField.HerdId];
    const known = herds.get(herdId);
    const sum = known === undefined ? { count: 0, kind: animals[offset + AnimalField.Kind], x: 0, z: 0 } : known;

    sum.count += 1;
    sum.x += animals[offset + AnimalField.X];
    sum.z += animals[offset + AnimalField.Z];
    herds.set(herdId, sum);
  }

  return herds;
}

export function herdMarks(frame: AnimalBuffer): MinimapMark[] {
  return [...sumHerds(frame).values()].map((herd) => {
    const style = ANIMAL_MARKERS[ANIMAL_KINDS[herd.kind]];

    return {
      color: cssColor(style.color),
      scale: (style.extent / ANIMAL_MARKERS.deer.extent) * herdScale(herd.count),
      shape: style.shape,
      x: herd.x / herd.count,
      z: herd.z / herd.count,
    };
  });
}

export function personMarks(frame: PersonBuffer): MinimapMark[] {
  const { people } = frame;

  const tribeColors = new Map(frame.tribes.map((tribe) => [tribe.id, tribe.color]));
  const marks: MinimapMark[] = [];

  for (let person = 0; person < frame.personCount; person += 1) {
    const offset = person * PERSON_STRIDE;

    const color = tribeColors.get(people[offset + PersonField.TribeId]);

    if (color === undefined || PERSON_POSES[people[offset + PersonField.Pose]] === "dead") {
      continue;
    }

    marks.push({
      color,
      scale: 1,
      shape: MarkerShape.Circle,
      x: people[offset + PersonField.X],
      z: people[offset + PersonField.Z],
    });
  }

  return marks;
}
