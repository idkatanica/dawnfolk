import { Slider } from "@base-ui/react/slider";
import { useId } from "react";
import { cn } from "./cn.ts";
import { useHeldDraft } from "./use-held-draft.ts";

export interface RangeFieldProps {
  readonly className?: string | undefined;
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

  const change = (next: number) => {
    hold(next);
    onChange(next);
  };

  return { change, shown };
}

export function RangeField({
  className,
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
    <div className={cn("flex flex-col gap-1.5", className)} title={description}>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium text-ink" id={labelId}>
          {label}
        </span>

        <span className="tabular text-ink-soft">{valueText}</span>
      </div>

      <Slider.Root
        aria-labelledby={labelId}
        max={maximum}
        min={minimum}
        onValueChange={change}
        step={step}
        value={shown}
      >
        <Slider.Control className="flex h-6 pointer-coarse:h-8 w-full touch-none select-none items-center">
          <Slider.Track className="h-1.5 w-full select-none rounded-full bg-ink/12">
            <Slider.Indicator className="select-none rounded-full bg-dawn" />

            <Slider.Thumb
              aria-label={label}
              className="pointer-coarse:size-6 size-4.5 select-none rounded-full bg-white ring-2 ring-dawn transition-[scale] duration-100 has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-dawn/40 data-dragging:scale-110"
            />
          </Slider.Track>
        </Slider.Control>
      </Slider.Root>
    </div>
  );
}
