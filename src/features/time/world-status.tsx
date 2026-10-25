import type { WeatherKind } from "../../content/weather.ts";
import { cn } from "../../design/cn.ts";
import { formatClock } from "../../design/format.ts";
import { GameIcon } from "../../design/game-icon.tsx";
import type { GameIconName } from "../../design/game-icon-sources.ts";
import { useWorldStore } from "../world/world-store.ts";

const WEATHER_ICONS: Readonly<Record<WeatherKind, GameIconName>> = {
  blizzard: "snow",
  clear: "clear",
  cloudy: "cloud",
  fog: "fog",
  heat: "heat",
  overcast: "overcast",
  rain: "rain",
  snow: "snow-cloud",
  storm: "storm",
};

function daylightIcon(hours: number): GameIconName {
  if (hours >= 5 && hours < 8) {
    return "sunrise";
  }

  if (hours >= 8 && hours < 18) {
    return "sun";
  }

  if (hours >= 18 && hours < 21) {
    return "sunset";
  }

  return "moon";
}

function WeatherReading() {
  const weather = useWorldStore((state) => state.snapshot?.weather);

  if (weather === undefined) {
    return null;
  }

  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap">
      <GameIcon name={WEATHER_ICONS[weather.kind]} size={22} />

      <span className="text-ink">{weather.name}</span>

      <span className="text-ink-muted text-xs tabular-nums">{Math.round(weather.windSpeed)} km/h</span>
    </span>
  );
}

function PopulationReading() {
  const population = useWorldStore((state) => state.snapshot?.statistics.population);
  const tribes = useWorldStore((state) => state.snapshot?.statistics.tribes);

  if (population === undefined || tribes === undefined) {
    return null;
  }

  const tribeCount = tribes === 1 ? "1 tribe" : `${tribes} tribes`;

  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap" title={`${population} people in ${tribeCount}`}>
      <GameIcon name="population" size={22} />

      <span className="text-ink tabular-nums">{population}</span>

      <span className="text-ink-muted text-xs">{tribeCount}</span>
    </span>
  );
}

export function CompactClock({ className }: { readonly className?: string | undefined }) {
  const calendar = useWorldStore((state) => state.snapshot?.calendar);

  if (calendar === undefined) {
    return null;
  }

  return (
    <div className={cn("@container flex min-w-0 items-center gap-2", className)}>
      <GameIcon className="@max-[6.5rem]:hidden" name={daylightIcon(calendar.hours)} size={24} />

      <div className="flex min-w-0 flex-col leading-none">
        <span className="font-semibold text-ink text-sm tabular-nums">{formatClock(calendar.hours)}</span>

        <span className="truncate text-2xs text-ink-muted">
          <span className="@max-[5rem]:hidden">{calendar.seasonName} · </span>
          Day {calendar.dayOfSeason}
        </span>
      </div>
    </div>
  );
}

export function WorldStatus() {
  const calendar = useWorldStore((state) => state.snapshot?.calendar);

  if (calendar === undefined) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <GameIcon name={daylightIcon(calendar.hours)} size={36} />

        <span className="flex flex-col gap-1 leading-none">
          <span className="font-semibold text-2xl text-ink tabular-nums">{formatClock(calendar.hours)}</span>

          <span className="text-ink-muted text-xs">
            {calendar.seasonName} · Day {calendar.dayOfSeason} · Year {calendar.year}
          </span>
        </span>
      </div>

      <div className="flex items-center gap-4 text-sm">
        <WeatherReading />

        <PopulationReading />
      </div>
    </div>
  );
}
