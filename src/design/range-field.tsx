import { Slider } from "@base-ui/react/slider";
import { useId } from "react";
import { useHeldDraft } from "./use-held-draft.ts";

interface RangeFieldProps {
  readonly description?: string | undefined;
  readonly label: string;
  readonly maximum: number;
  readonly minimum: number;
  readonly onChange: (value: number) => void;
  readonly step: number;
  readonly value: number;
  readonly valueText: string;
}

function useHeldRange(value: number, onChange: (value: number) => void) {
  const [shown, hold] = useHeldDraft(value);

  function change(next: number): void {
    hold(next);
    onChange(next);
  }

  return { change, shown };
}

export function RangeField({
  description,
  label,
  maximum,
  minimum,
  onChange,
  step,
  value,
  valueText,
}: RangeFieldProps) {
  const labelId = useId();

  const { change, shown } = useHeldRange(value, onChange);

  return (
    <div className="flex flex-col gap-1" title={description}>
      <div className="flex items-baseline justify-between gap-3 text-sm leading-5">
        <span className="font-medium text-ink" id={labelId}>
          {label}
        </span>

        <span className="shrink-0 text-right text-ink-soft tabular-nums">{valueText}</span>
      </div>

      <Slider.Root
        aria-labelledby={labelId}
        max={maximum}
        min={minimum}
        onValueChange={change}
        step={step}
        value={shown}
      >
        <Slider.Control className="flex h-5 pointer-coarse:h-8 w-full touch-none select-none items-center">
          <Slider.Track className="h-1 w-full select-none rounded-full bg-ink/10">
            <Slider.Indicator className="select-none rounded-full bg-dawn" />

            <Slider.Thumb
              aria-label={label}
              className="pointer-coarse:size-5 size-3.5 select-none rounded-full bg-white shadow-thumb transition-[scale,box-shadow] duration-100 has-focus-visible:ring-4 has-focus-visible:ring-dawn/35 data-dragging:scale-115"
            />
          </Slider.Track>
        </Slider.Control>
      </Slider.Root>
    </div>
  );
}
