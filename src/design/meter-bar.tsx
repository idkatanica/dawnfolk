import { Meter } from "@base-ui/react/meter";
import { cn } from "./cn.ts";

type MeterTone = "dawn" | "ember" | "gold" | "lake" | "meadow";

const INDICATOR_TONES: Readonly<Record<MeterTone, string>> = {
  dawn: "bg-dawn",
  ember: "bg-ember",
  gold: "bg-gold",
  lake: "bg-lake",
  meadow: "bg-meadow",
};

interface MeterBarProps {
  readonly className?: string | undefined;
  readonly label: string;
  readonly tone: MeterTone;
  readonly value: number;
  readonly valueText: string;
}

export function MeterBar({ className, label, tone, value, valueText }: MeterBarProps) {
  return (
    <Meter.Root className={cn("grid grid-cols-2 gap-y-1", className)} max={1} min={0} value={value}>
      <Meter.Label className="text-ink-soft text-xs">{label}</Meter.Label>

      <span className="tabular text-right font-medium text-ink text-xs">{valueText}</span>

      <Meter.Track className="col-span-2 h-1.5 overflow-hidden rounded-full bg-ink/10">
        <Meter.Indicator className={cn("rounded-full transition-[width] duration-500", INDICATOR_TONES[tone])} />
      </Meter.Track>
    </Meter.Root>
  );
}
