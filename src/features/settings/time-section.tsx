import { useSendCommand } from "../../app/use-engine.ts";
import { SEASONS } from "../../content/seasons.ts";
import { ChoiceField } from "../../design/choice-field.tsx";
import { formatClock, formatParameterValue } from "../../design/format.ts";
import { RangeField } from "../../design/range-field.tsx";
import { ToggleField } from "../../design/toggle-field.tsx";
import type { CalendarView } from "../../simulation/nature/calendar.ts";
import { MAXIMUM_DAY_SECONDS, MINIMUM_DAY_SECONDS } from "../../simulation/nature/calendar.ts";
import { useWorldStore } from "../world/world-store.ts";

const SEASON_OPTIONS = SEASONS.map((season, index) => ({ label: season, value: String(index) }));

function useTimeSettings() {
  const send = useSendCommand();

  const changeHours = (hours: number) => send({ hours, type: "setHours" });
  const changeSeason = (value: string) => send({ season: Number(value), type: "setSeason" });
  const changeDayLength = (seconds: number) => send({ seconds, type: "setDaySeconds" });
  const changeSeasonLength = (days: number) => send({ days, type: "setDaysPerSeason" });
  const changeFrozen = (isFrozen: boolean) => send({ isFrozen, type: "setTimeFrozen" });

  return { changeDayLength, changeFrozen, changeHours, changeSeason, changeSeasonLength };
}

function TimeControls({ calendar }: { readonly calendar: CalendarView }) {
  const { changeDayLength, changeFrozen, changeHours, changeSeason, changeSeasonLength } = useTimeSettings();

  return (
    <div className="grid gap-x-5 gap-y-4 rounded-2xl bg-veil p-4 sm:grid-cols-2">
      <RangeField
        className="sm:col-span-2"
        label="Time of day"
        maximum={23.9}
        minimum={0}
        onChange={changeHours}
        step={0.1}
        value={calendar.hours}
        valueText={formatClock(calendar.hours)}
      />

      <ChoiceField
        className="sm:col-span-2"
        label="Season"
        onChange={changeSeason}
        options={SEASON_OPTIONS}
        value={String(Math.floor(calendar.season) % SEASONS.length)}
      />

      <RangeField
        description="Real seconds in one day at normal speed."
        label="Day length"
        maximum={MAXIMUM_DAY_SECONDS}
        minimum={MINIMUM_DAY_SECONDS}
        onChange={changeDayLength}
        step={30}
        value={calendar.daySeconds}
        valueText={formatParameterValue(calendar.daySeconds, "seconds")}
      />

      <RangeField
        label="Season length"
        maximum={30}
        minimum={1}
        onChange={changeSeasonLength}
        step={1}
        value={calendar.daysPerSeason}
        valueText={formatParameterValue(calendar.daysPerSeason, "days")}
      />

      <ToggleField
        className="sm:col-span-2"
        description="Keep the sun where it is while life goes on."
        isChecked={calendar.isTimeFrozen}
        label="Stop the clock"
        onChange={changeFrozen}
      />
    </div>
  );
}

export function TimeSection() {
  const calendar = useWorldStore((state) => state.snapshot?.calendar);

  if (calendar === undefined) {
    return null;
  }

  return <TimeControls calendar={calendar} />;
}
