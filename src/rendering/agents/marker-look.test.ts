import { describe, expect, it } from "vitest";
import { ANIMAL_KINDS } from "../../content/animals.ts";
import {
  ANIMAL_MARKERS,
  herdGathering,
  herdScale,
  MarkerImportance,
  MarkerShape,
  markerExtent,
  markerPresence,
  personMarker,
  SELECTED_MARKER_SCALE,
} from "./marker-look.ts";

const BEAR_CLAN = 0xc8_55_3d;
const HANDOVER = 420;

describe("marker look", () => {
  it("gives every kind of animal a color of its own", () => {
    const colors = new Set(
      ANIMAL_KINDS.map((kind) => {
        return ANIMAL_MARKERS[kind].color;
      })
    );

    expect(colors.size).toBe(ANIMAL_KINDS.length);
  });

  it("marks wolves as a larger warning triangle above the other animals", () => {
    const { wolf } = ANIMAL_MARKERS;

    const prey = ANIMAL_KINDS.filter((kind) => {
      return kind !== "wolf";
    }).map((kind) => {
      return ANIMAL_MARKERS[kind];
    });

    expect(wolf.shape).toBe(MarkerShape.Triangle);
    expect(
      prey.every((style) => {
        return style.shape === MarkerShape.Diamond;
      })
    ).toBe(true);
    expect(
      prey.every((style) => {
        return style.importance < wolf.importance;
      })
    ).toBe(true);
    expect(
      prey.every((style) => {
        return style.extent < wolf.extent;
      })
    ).toBe(true);
  });

  it("marks people as circles in their tribe's color above every animal", () => {
    const person = personMarker(BEAR_CLAN);

    expect(person.color).toBe(BEAR_CLAN);
    expect(person.shape).toBe(MarkerShape.Circle);
    expect(person.importance).toBe(MarkerImportance.Person);
    expect(
      ANIMAL_KINDS.every((kind) => {
        return ANIMAL_MARKERS[kind].importance < person.importance;
      })
    ).toBe(true);
  });

  it("fades a marker in before its figure is dropped", () => {
    const presences = [0.2, 0.4, 0.5, 0.6, 0.75, 1].map((share) => {
      return markerPresence(HANDOVER * share, HANDOVER);
    });

    expect(presences[0]).toBe(0);
    expect(presences.at(-1)).toBe(1);
    expect(markerPresence(HANDOVER * 0.75, HANDOVER)).toBe(1);
    expect(
      presences.every((presence, index) => {
        return index === 0 || presence >= presences[index - 1];
      })
    ).toBe(true);
  });

  it("keeps the full size once present and grows the selected marker", () => {
    const person = personMarker(BEAR_CLAN);

    expect(markerExtent(person, 1, false)).toBe(person.extent);
    expect(markerExtent(person, 1, true)).toBeCloseTo(person.extent * SELECTED_MARKER_SCALE);
    expect(markerExtent(person, 0.5, false)).toBeLessThan(person.extent);
    expect(markerExtent(person, 0, false)).toBeGreaterThan(0);
  });

  it("gathers a herd once its members would overlap on screen", () => {
    const { extent } = ANIMAL_MARKERS.deer;

    expect(herdGathering(extent * 0.5, extent)).toBe(1);
    expect(herdGathering(extent * 1.7, extent)).toBeGreaterThan(0);
    expect(herdGathering(extent * 1.7, extent)).toBeLessThan(1);
    expect(herdGathering(extent * 4, extent)).toBe(0);
  });

  it("grows a gathered herd slightly with its size", () => {
    expect(herdScale(1)).toBe(1);
    expect(herdScale(3)).toBeGreaterThan(1);
    expect(herdScale(6)).toBeGreaterThan(herdScale(3));
    expect(herdScale(40)).toBe(herdScale(80));
    expect(herdScale(80)).toBeLessThan(1.5);
  });
});
