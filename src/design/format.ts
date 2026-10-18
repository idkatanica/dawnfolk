import type { ParameterUnit } from "../content/parameters.ts";

const LARGEST_DECIMALS = 3;

export function decimalsOf(step: number): number {
  const [, fraction = ""] = String(step).split(".");

  return Math.min(LARGEST_DECIMALS, fraction.length);
}

function fixed(value: number, step: number): string {
  return value.toFixed(decimalsOf(step));
}

function signed(text: string, value: number): string {
  if (value > 0) {
    return `+${text}`;
  }

  return text;
}

export function formatParameterValue(value: number, unit: ParameterUnit, step = 1): string {
  switch (unit) {
    case "celsius":
      return `${signed(fixed(value, step), value)} °C`;
    case "count":
      return fixed(value, step);
    case "days":
      return value === 1 ? "1 day" : `${fixed(value, step)} days`;
    case "kilometersPerHour":
      return `${fixed(value, step)} km/h`;
    case "meters":
      return `${fixed(value, step)} m`;
    case "multiplier":
      return `×${value.toFixed(Math.max(1, decimalsOf(step)))}`;
    case "percent":
      return `${fixed(value, step)}%`;
    case "seconds":
      return `${fixed(value, step)} s`;
    default:
      return unit satisfies never;
  }
}

export function formatClock(hours: number): string {
  const wholeMinutes = Math.floor(hours * 60) % (24 * 60);
  const hour = Math.floor(wholeMinutes / 60);
  const minute = wholeMinutes % 60;

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function formatPercent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}
