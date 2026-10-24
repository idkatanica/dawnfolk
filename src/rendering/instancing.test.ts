import { InstancedBufferGeometry } from "three/webgpu";
import { describe, expect, it } from "vitest";
import { InterleavedInstances } from "./instancing.ts";

describe("instance buffers", () => {
  it("keep their instances when interleaved fields grow", () => {
    const fields = [
      { name: "position", size: 3 },
      { name: "scale", size: 1 },
    ];
    const instances = new InterleavedInstances(new InstancedBufferGeometry(), fields, 2);

    instances.array.set([1, 2, 3, 4, 5, 6, 7, 8]);
    instances.ensureCapacity(5);

    expect(instances.capacity).toBeGreaterThanOrEqual(5);
    expect([...instances.array.subarray(0, 8)]).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});
