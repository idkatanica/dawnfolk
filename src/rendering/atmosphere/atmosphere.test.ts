import { Scene, Vector3 } from "three/webgpu";
import { describe, expect, it } from "vitest";
import { Atmosphere } from "./atmosphere.ts";

const CLEAR_SKY = {
  cloudCover: 0,
  flash: 0,
  fog: 0,
  hours: 12,
  precipitation: 0,
  season: 1,
  snowfall: 0,
  storm: 0,
  windX: 0,
  windZ: 0,
};

const HOUR_STEP = 0.001;
const MOONLIGHT = 0.7;

function createAtmosphere(): Atmosphere {
  return new Atmosphere(new Scene(), { cloudSeaAltitude: -200, shadowMapSize: 1024 });
}

function lightAt(atmosphere: Atmosphere, hours: number): number {
  atmosphere.update({ ...CLEAR_SKY, hours }, new Vector3(), 800, 0);

  return atmosphere.sun.intensity;
}

function largestStep(atmosphere: Atmosphere, fromHours: number, toHours: number): number {
  let largest = 0;
  let previous = lightAt(atmosphere, fromHours);

  for (let hours = fromHours + HOUR_STEP; hours <= toHours; hours += HOUR_STEP) {
    const light = lightAt(atmosphere, hours);

    largest = Math.max(largest, Math.abs(light - previous));
    previous = light;
  }

  return largest;
}

describe("Atmosphere", () => {
  it("fades the moonlight in after sunset", () => {
    const atmosphere = createAtmosphere();

    expect(largestStep(atmosphere, 19, 21)).toBeLessThan(0.02);
  });

  it("fades the moonlight out before sunrise", () => {
    const atmosphere = createAtmosphere();

    expect(largestStep(atmosphere, 3.5, 5)).toBeLessThan(0.02);
  });

  it("keeps the full moonlight at midnight", () => {
    const atmosphere = createAtmosphere();

    expect(lightAt(atmosphere, 0)).toBeCloseTo(MOONLIGHT, 5);
  });
});
