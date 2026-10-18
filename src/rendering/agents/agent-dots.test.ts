import { describe, expect, it } from "vitest";
import { CameraAxes } from "../effects/billboards.ts";
import { AgentDots } from "./agent-dots.ts";

const TRIBE_RED = 0xc8_55_3d;

describe("agent dots", () => {
  it("marks every far agent with a dot", () => {
    const dots = new AgentDots(new CameraAxes());

    dots.begin();
    dots.add(0, 10, 0, 800, TRIBE_RED);
    dots.add(20, 10, 0, 3000, TRIBE_RED);
    dots.commit();

    expect(dots.count).toBe(2);
    expect(dots.mesh.visible).toBe(true);
  });

  it("leaves out agents beyond the horizon of the dots", () => {
    const dots = new AgentDots(new CameraAxes());

    dots.begin();
    dots.add(0, 10, 0, 6000, TRIBE_RED);
    dots.commit();

    expect(dots.count).toBe(0);
    expect(dots.mesh.visible).toBe(false);
  });

  it("starts over every frame", () => {
    const dots = new AgentDots(new CameraAxes());

    dots.begin();
    dots.add(0, 10, 0, 800, TRIBE_RED);
    dots.commit();
    dots.begin();
    dots.commit();

    expect(dots.count).toBe(0);
  });
});
