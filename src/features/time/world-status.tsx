import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  Cloudy,
  type LucideIcon,
  Moon,
  Snowflake,
  Sun,
  Sunrise,
  Sunset,
  ThermometerSun,
  Users,
  Wind,
} from "lucide-react";
import type { ReactNode } from "react";
import type { WeatherKind } from "../../content/weather.ts";
import { cn } from "../../design/cn.ts";
import { formatClock } from "../../design/format.ts";
import { Island } from "../../design/island.tsx";
import type { CalendarView } from "../../simulation/nature/calendar.ts";
import { useWorldStore } from "../world/world-store.ts";

const WEATHER_ICONS: Readonly<Record<WeatherKind, LucideIcon>> = {
  blizzard: Snowflake,
  clear: Sun,
  cloudy: Cloud,
  fog: CloudFog,
  heat: ThermometerSun,
  overcast: Cloudy,
  rain: CloudRain,
  snow: CloudSnow,
  storm: CloudLightning,
};

function daylightIcon(hours: number): LucideIcon {
  if (hours >= 5 && hours < 8) {
    return Sunrise;
  }

  if (hours >= 8 && hours < 18) {
    return Sun;
  }

  if (hours >= 18 && hours < 21) {
    return Sunset;
  }

  return Moon;
}

interface ReadingProps {
  readonly detail: ReactNode;
  readonly icon: LucideIcon;
  readonly title?: string | undefined;
  readonly value: ReactNode;
}

function Reading({ detail, icon: Icon, title, value }: ReadingProps) {
  return (
    <div className="flex items-center gap-2.5 whitespace-nowrap text-ink-soft" title={title}>
      <Icon aria-hidden="true" className="shrink-0" size={18} />

      <span className="flex flex-col gap-1 leading-none">
        <span className="font-semibold text-ink text-sm tabular-nums">{value}</span>

        <span className="flex items-center gap-1 text-ink-muted text-xs max-lg:hidden">{detail}</span>
      </span>
    </div>
  );
}

function StatusIsland({ children }: { readonly children: ReactNode }) {
  return (
    <Island>
      <div className="flex h-13 pointer-coarse:h-14 items-center px-4">{children}</div>
    </Island>
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
    <StatusIsland>
      <Reading
        detail={
          <>
            <Wind aria-hidden="true" size={11} />

            <span className="tabular-nums">{Math.round(weather.windSpeed)} km/h</span>
          </>
        }
        icon={WEATHER_ICONS[weather.kind]}
        value={weather.name}
      />
    </StatusIsland>
  );
}

function PopulationReading() {
  const population = useWorldStore((state) => state.snapshot?.statistics.population);
  const tribes = useWorldStore((state) => state.snapshot?.statistics.tribes);

  if (population === undefined || tribes === undefined) {
    return null;
  }

  return (
    <StatusIsland>
      <Reading
        detail={tribes === 1 ? "1 tribe" : `${tribes} tribes`}
        icon={Users}
        title={`${tribes} tribes`}
        value={population}
      />
    </StatusIsland>
  );
}

export function CompactClock({ className }: { readonly className?: string | undefined }) {
  const calendar = useWorldStore((state) => state.snapshot?.calendar);

  if (calendar === undefined) {
    return null;
  }

  const DaylightIcon = daylightIcon(calendar.hours);

  return (
    <div className={cn("@container flex min-w-0 items-center gap-2", className)}>
      <DaylightIcon aria-hidden="true" className="@max-[6.5rem]:hidden shrink-0" size={18} />

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
    <div className={cn("flex items-start gap-3", className)}>
      <StatusIsland>
        <ClockReading calendar={calendar} />
      </StatusIsland>

      <WeatherReading />

      <PopulationReading />
    </div>
  );
}
