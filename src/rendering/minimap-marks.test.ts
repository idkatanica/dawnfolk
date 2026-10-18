import { describe, expect, it } from "vitest";
import { ANIMAL_KINDS, type AnimalKind } from "../content/animals.ts";
import { ANIMAL_STRIDE, AnimalField, PERSON_STRIDE, PersonField } from "../world/agent-buffers.ts";
import { type AnimalPose, animalPoseCode, type PersonPose, personPoseCode } from "../world/agent-poses.ts";
import { herdScale, MarkerShape } from "./agents/marker-look.ts";
import { herdMarks, personMarks } from "./minimap-marks.ts";

interface AnimalAt {
  readonly herd: number;
  readonly kind: AnimalKind;
  readonly pose: AnimalPose;
  readonly x: number;
  readonly z: number;
}

interface PersonAt {
  readonly pose: PersonPose;
  readonly tribe: number;
  readonly x: number;
  readonly z: number;
}

function animalBuffer(animals: readonly AnimalAt[]) {
  const buffer = new Float32Array(animals.length * ANIMAL_STRIDE);

  for (const [index, animal] of animals.entries()) {
    const offset = index * ANIMAL_STRIDE;

    buffer[offset + AnimalField.HerdId] = animal.herd;
    buffer[offset + AnimalField.Kind] = ANIMAL_KINDS.indexOf(animal.kind);
    buffer[offset + AnimalField.Pose] = animalPoseCode(animal.pose);
    buffer[offset + AnimalField.X] = animal.x;
    buffer[offset + AnimalField.Z] = animal.z;
  }

  return { animalCount: animals.length, animals: buffer };
}

function personBuffer(people: readonly PersonAt[]) {
  const buffer = new Float32Array(people.length * PERSON_STRIDE);

  for (const [index, person] of people.entries()) {
    const offset = index * PERSON_STRIDE;

    buffer[offset + PersonField.Pose] = personPoseCode(person.pose);
    buffer[offset + PersonField.TribeId] = person.tribe;
    buffer[offset + PersonField.X] = person.x;
    buffer[offset + PersonField.Z] = person.z;
  }

  return { people: buffer, personCount: people.length, tribes: [{ color: "#c8553d", id: 1 }] };
}

describe("minimap marks", () => {
  it("marks each herd once at the centre of its living animals", () => {
    const marks = herdMarks(
      animalBuffer([
        { herd: 4, kind: "deer", pose: "graze", x: 0, z: 0 },
        { herd: 4, kind: "deer", pose: "walk", x: 30, z: 0 },
        { herd: 4, kind: "deer", pose: "graze", x: 30, z: 30 },
        { herd: 4, kind: "deer", pose: "dead", x: 900, z: 900 },
        { herd: 9, kind: "wolf", pose: "run", x: -500, z: 200 },
      ])
    );

    const [deer, wolves] = marks;

    expect(marks).toHaveLength(2);
    expect(deer).toMatchObject({ color: "#d9a55c", scale: herdScale(3), shape: MarkerShape.Diamond, x: 20, z: 10 });
    expect(wolves).toMatchObject({ color: "#e2443a", shape: MarkerShape.Triangle, x: -500, z: 200 });
  });

  it("marks living people in their tribe's colour", () => {
    const marks = personMarks(
      personBuffer([
        { pose: "walk", tribe: 1, x: 12, z: -40 },
        { pose: "dead", tribe: 1, x: 0, z: 0 },
        { pose: "idle", tribe: 3, x: 0, z: 0 },
      ])
    );

    expect(marks).toEqual([{ color: "#c8553d", scale: 1, shape: MarkerShape.Circle, x: 12, z: -40 }]);
  });
});
