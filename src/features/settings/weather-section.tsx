import { useSendCommand } from "../../app/use-engine.ts";
import { WEATHER, WEATHER_KINDS, type WeatherKind } from "../../content/weather.ts";
import { ChoiceField } from "../../design/choice-field.tsx";
import { formatParameterValue } from "../../design/format.ts";
import { RangeField } from "../../design/range-field.tsx";
import { useHeldDraft } from "../../design/use-held-draft.ts";
import type { WeatherView } from "../../simulation/frame.ts";
import { useWorldStore } from "../world/world-store.ts";

const AUTOMATIC = "automatic";

const WEATHER_OPTIONS = [
  { label: "Changes by itself", value: AUTOMATIC },
  ...WEATHER_KINDS.map((kind) => ({ label: WEATHER[kind].name, value: kind })),
];

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;

function compassName(degrees: number): string {
  const index = Math.round((((degrees % 360) + 360) % 360) / 45) % COMPASS.length;

  const name = COMPASS[index];

  if (name === undefined) {
    return "N";
  }

  return name;
}

function isWeatherChoice(value: string): value is WeatherKind | typeof AUTOMATIC {
  return value === AUTOMATIC || WEATHER_KINDS.some((kind) => kind === value);
}

interface WindSetting {
  readonly direction: number;
  readonly speed: number;
}

function useWeatherControls(weather: WeatherView) {
  const send = useSendCommand();

  const [wind, holdWind] = useHeldDraft<WindSetting>({
    direction: weather.windDirection,
    speed: weather.windBaseSpeed,
  });

  function changeWeather(value: string): void {
    if (isWeatherChoice(value)) {
      send({ type: "setWeather", weather: value });
    }
  }

  function changeWind(next: WindSetting): void {
    holdWind(next);
    send({ ...next, type: "setWind" });
  }

  function changeDirection(direction: number): void {
    changeWind({ ...wind, direction });
  }

  function changeSpeed(speed: number): void {
    changeWind({ ...wind, speed });
  }

  function changeTemperature(offset: number): void {
    send({ offset, type: "setTemperatureOffset" });
  }

  return { changeDirection, changeSpeed, changeTemperature, changeWeather, wind };
}

function WeatherControls({ weather }: { readonly weather: WeatherView }) {
  const { changeDirection, changeSpeed, changeTemperature, changeWeather, wind } = useWeatherControls(weather);

  const choice = weather.isAutomatic ? AUTOMATIC : weather.kind;

  return (
    <div className="grid gap-x-5 gap-y-4 rounded-2xl bg-veil p-4 sm:grid-cols-2">
      <ChoiceField
        className="sm:col-span-2"
        description="Pick the weather or let the seasons decide."
        label="Weather"
        onChange={changeWeather}
        options={WEATHER_OPTIONS}
        value={choice}
      />

      <RangeField
        description="Where the wind blows from."
        label="Wind from"
        maximum={359}
        minimum={0}
        onChange={changeDirection}
        step={1}
        value={Math.round(wind.direction)}
        valueText={`${compassName(wind.direction)} · ${Math.round(wind.direction)}°`}
      />

      <RangeField
        description="Base wind speed before gusts."
        label="Wind speed"
        maximum={90}
        minimum={0}
        onChange={changeSpeed}
        step={1}
        value={Math.round(wind.speed)}
        valueText={formatParameterValue(wind.speed, "kilometersPerHour")}
      />

      <RangeField
        className="sm:col-span-2"
        description="Makes the whole island warmer or colder."
        label="Temperature"
        maximum={30}
        minimum={-30}
        onChange={changeTemperature}
        step={1}
        value={Math.round(weather.userTemperatureOffset)}
        valueText={formatParameterValue(Math.round(weather.userTemperatureOffset), "celsius")}
      />
    </div>
  );
}

export function WeatherSection() {
  const weather = useWorldStore((state) => state.snapshot?.weather);

  if (weather === undefined) {
    return null;
  }

  return <WeatherControls weather={weather} />;
}
