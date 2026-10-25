import type { ReactNode } from "react";
import type { WeatherKind } from "../../content/weather.ts";
import { cn } from "../../design/cn.ts";
import { Divider } from "../../design/divider.tsx";
import { formatClock } from "../../design/format.ts";
import { GameIcon } from "../../design/game-icon.tsx";
import type { GameIconName } from "../../design/game-icon-sources.ts";
import type { CalendarView } from "../../simulation/nature/calendar.ts";
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

interface ReadingProps {
  readonly detail: ReactNode;
  readonly icon: GameIconName;
  readonly title?: string | undefined;
  readonly value: ReactNode;
}

function Reading({ detail, icon, title, value }: ReadingProps) {
  return (
    <div className="flex items-center gap-2 whitespace-nowrap text-ink-soft" title={title}>
      <GameIcon name={icon} size={24} />

      <span className="flex flex-col gap-0.5 leading-none">
        <span className="font-semibold text-ink text-sm tabular-nums">{value}</span>

        <span className="flex items-center gap-1 text-ink-muted text-xs max-lg:hidden">{detail}</span>
      </span>
    </div>
  );
}

function ClockReading({ calendar }: { readonly calendar: CalendarView }) {
  return (
    <Reading
      detail={`${calendar.seasonName} · Day ${calendar.dayOfSeason} · Year ${calendar.year}`}
      icon={daylightIcon(calendar.hours)}
      value={formatClock(calendar.hours)}
    />
  );
}

function WeatherReading() {
  const weather = useWorldStore((state) => state.snapshot?.weather);

  if (weather === undefined) {
    return null;
  }

  return (
    <>
      <Divider />

      <Reading
        detail={
          <>
            <GameIcon name="wind" size={14} />

            <span className="tabular-nums">{Math.round(weather.windSpeed)} km/h</span>
          </>
        }
        icon={WEATHER_ICONS[weather.kind]}
        value={weather.name}
      />
    </>
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
    <>
      <Divider />

      <Reading
        detail={tribeCount}
        icon="population"
        title={`${population} people in ${tribeCount}`}
        value={population}
      />
    </>
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

export function WorldStatus({ className }: { readonly className?: string | undefined }) {
  const calendar = useWorldStore((state) => state.snapshot?.calendar);

  if (calendar === undefined) {
    return null;
  }

  return (
    <div className={cn("flex items-center gap-3 lg:gap-4", className)}>
      <ClockReading calendar={calendar} />

      <WeatherReading />

      <PopulationReading />
    </div>
  );
}
