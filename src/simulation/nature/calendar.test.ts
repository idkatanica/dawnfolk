import { describe, expect, it } from "vitest";
import { Calendar, DEFAULT_DAY_SECONDS } from "./calendar.ts";

function calendarAt(day: number): Calendar {
  const calendar = new Calendar();

  calendar.day = day;

  return calendar;
}

describe("calendar", () => {
  it("starts on a spring morning", () => {
    const calendar = new Calendar();

    expect(calendar.view().seasonName).toBe("Spring");
    expect(calendar.hours).toBeCloseTo(8.64);
    expect(calendar.year).toBe(1);
  });

  it("advances by real day length", () => {
    const calendar = calendarAt(0);

    const days = calendar.advance(DEFAULT_DAY_SECONDS / 2);

    expect(days).toBeCloseTo(0.5);
    expect(calendar.hours).toBeCloseTo(12);
  });

  it("stands still while time is frozen", () => {
    const calendar = new Calendar();

    const start = calendar.day;

    calendar.isTimeFrozen = true;

    expect(calendar.advance(100)).toBe(0);
    expect(calendar.day).toBe(start);
  });

  it("walks through the seasons and years", () => {
    expect(calendarAt(3.5).view().seasonName).toBe("Summer");
    expect(calendarAt(6.5).view().seasonName).toBe("Autumn");
    expect(calendarAt(9.5).view().seasonName).toBe("Winter");
    expect(calendarAt(12.5).year).toBe(2);
    expect(calendarAt(4.2).dayOfSeason).toBe(2);
  });

  it("sets the time of day without changing the date", () => {
    const calendar = calendarAt(5.25);

    calendar.setHours(18);

    expect(Math.floor(calendar.day)).toBe(5);
    expect(calendar.hours).toBeCloseTo(18);
  });

  it("jumps to a season and keeps the time of day", () => {
    const calendar = calendarAt(1.75);

    calendar.setSeason(2);

    expect(calendar.view().seasonName).toBe("Autumn");
    expect(calendar.hours).toBeCloseTo(18);
  });

  it("keeps the season when seasons get longer", () => {
    const calendar = calendarAt(4.5);

    calendar.setDaysPerSeason(6);

    expect(calendar.view().seasonName).toBe("Summer");
    expect(calendar.hours).toBeCloseTo(12);
  });

  it("keeps counting elapsed days while the date is set", () => {
    const calendar = calendarAt(15.2);

    calendar.setDaysPerSeason(30);

    expect(calendar.day).toBeCloseTo(15.2);
    expect(calendar.view().seasonName).toBe("Summer");
    expect(calendar.year).toBe(2);
    expect(calendar.hours).toBeCloseTo(4.8);

    calendar.setDaysPerSeason(1);

    expect(calendar.day).toBeCloseTo(15.2);
    expect(calendar.view().seasonName).toBe("Summer");
    expect(calendar.year).toBe(2);
    expect(calendar.dayOfSeason).toBe(1);

    calendar.setSeason(0);
    calendar.setHours(14);

    expect(calendar.day).toBeCloseTo(15.2);
    expect(calendar.view().seasonName).toBe("Spring");
    expect(calendar.year).toBe(2);
    expect(calendar.dayOfSeason).toBe(1);
    expect(calendar.hours).toBeCloseTo(14);

    calendar.advance(DEFAULT_DAY_SECONDS);

    expect(calendar.day).toBeCloseTo(16.2);
    expect(calendar.view().seasonName).toBe("Summer");
    expect(calendar.hours).toBeCloseTo(14);
  });

  it("is warmest in the afternoon and coldest before dawn", () => {
    const afternoon = calendarAt(15 / 24);
    const night = calendarAt(3 / 24);

    expect(afternoon.diurnalTemperatureOffset()).toBeCloseTo(4.5);
    expect(night.diurnalTemperatureOffset()).toBeCloseTo(-4.5);
  });

  it("knows when it is night", () => {
    expect(calendarAt(23 / 24).isNight).toBe(true);
    expect(calendarAt(4 / 24).isNight).toBe(true);
    expect(calendarAt(12 / 24).isNight).toBe(false);
  });
});
