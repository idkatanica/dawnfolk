import { PerspectiveCamera, Vector3 } from "three/webgpu";
import { describe, expect, it } from "vitest";
import type { SimulationFrame } from "../../simulation/frame.ts";
import { Simulation } from "../../simulation/simulation.ts";
import { createVegetatedWorld } from "../../simulation/testing/test-world.ts";
import { PERSON_STRIDE, PersonField } from "../../world/agent-buffers.ts";
import { EntityPicker } from "./entity-picker.ts";
import { GroundPicker } from "./ground-picker.ts";

const VIEWPORT = { height: 600, width: 800 };
const CENTER = { x: 400, y: 300 };
const WORLD_HALF_SIZE = 2000;
const EMPTY_FRAME = new Simulation(
  createVegetatedWorld({ dimensions: { cellSize: 10, cellsPerSide: 32 } })
).initialWorld().frame;

function frameWithPeople(...positions: readonly (readonly [number, number])[]): SimulationFrame {
  return {
    ...EMPTY_FRAME,
    animalCount: 0,
    buildings: [],
    people: peopleAt(...positions),
    personCount: positions.length,
  };
}

function ridgeHeight(x: number, z: number): number {
  const isOnRidge = Math.abs(x) < 500 && Math.abs(z - 120) < 30;

  return isOnRidge ? 200 : 0;
}

function cameraLookingAt(x: number, z: number): PerspectiveCamera {
  const camera = new PerspectiveCamera(45, VIEWPORT.width / VIEWPORT.height, 1, 40_000);

  camera.position.set(x, 400, z + 300);
  camera.lookAt(x, 0, z);
  camera.updateMatrixWorld();

  return camera;
}

function peopleAt(...positions: readonly (readonly [number, number])[]): Float32Array {
  const people = new Float32Array(positions.length * PERSON_STRIDE);

  for (const [index, [x, z]] of positions.entries()) {
    people[index * PERSON_STRIDE + PersonField.Id] = index + 1;
    people[index * PERSON_STRIDE + PersonField.X] = x;
    people[index * PERSON_STRIDE + PersonField.Z] = z;
  }

  return people;
}

function pickAt(heightAt: (x: number, z: number) => number, ...positions: readonly (readonly [number, number])[]) {
  const camera = cameraLookingAt(0, 0);
  const frame = frameWithPeople(...positions);

  const ground = new GroundPicker(camera, heightAt, WORLD_HALF_SIZE).pick(CENTER, VIEWPORT);

  return new EntityPicker(camera, heightAt).pick(frame, CENTER, VIEWPORT, ground);
}

describe("entity picker", () => {
  it("picks the person under the pointer", () => {
    expect(pickAt(() => 0, [0, 0])).toEqual({ id: 1, kind: "person" });
  });

  it("falls back to the ground when nobody is near the pointer", () => {
    const selection = pickAt(() => 0, [300, 0]);

    expect(selection).toMatchObject({ kind: "cell" });
  });

  it("ignores a person hidden behind a ridge", () => {
    expect(pickAt(ridgeHeight, [0, 0])).toMatchObject({ kind: "cell" });
  });

  it("ignores people behind the camera", () => {
    const camera = cameraLookingAt(0, 0);
    const frame = frameWithPeople([0, 900]);

    const picker = new EntityPicker(camera, () => 0);

    expect(picker.pick(frame, CENTER, VIEWPORT, new Vector3(0, 0, 0))).toMatchObject({ kind: "cell" });
  });
});
