const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const JUST_NOW = 45 * SECOND;

const relativeTime = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function formatSavedAt(savedAt: number, now: number): string {
  const elapsed = Math.max(0, now - savedAt);

  if (elapsed < JUST_NOW) {
    return "just now";
  }

  if (elapsed < HOUR) {
    return relativeTime.format(-Math.max(1, Math.round(elapsed / MINUTE)), "minute");
  }

  if (elapsed < DAY) {
    return relativeTime.format(-Math.round(elapsed / HOUR), "hour");
  }

  return relativeTime.format(-Math.round(elapsed / DAY), "day");
}

export function describePeople(population: number): string {
  if (population === 1) {
    return "1 person";
  }

  return `${population} people`;
}
