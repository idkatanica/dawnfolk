import { Select } from "@base-ui/react/select";
import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import { Check, ChevronsUpDown } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "./cn.ts";
import { SEGMENT, SEGMENT_TRACK } from "./segmented.ts";

export interface ChoiceOption {
  readonly icon?: ReactNode;
  readonly label: string;
  readonly value: string;
}

interface ChoiceFieldProps {
  readonly className?: string | undefined;
  readonly description?: string | undefined;
  readonly label: string;
  readonly onChange: (value: string) => void;
  readonly options: readonly ChoiceOption[];
  readonly value: string;
}

const SEGMENTED_LIMIT = 3;

function SegmentOption({ option }: { readonly option: ChoiceOption }) {
  return (
    <Toggle className={cn(SEGMENT, "h-8 flex-1")} value={option.value}>
      {option.icon}

      {option.label}
    </Toggle>
  );
}

function useSegmentChange(onChange: (value: string) => void) {
  return (values: string[]) => {
    const [selected] = values;

    if (selected !== undefined) {
      onChange(selected);
    }
  };
}

function useListChange(onChange: (value: string) => void) {
  return (selected: string | null) => {
    if (selected !== null) {
      onChange(selected);
    }
  };
}

function SegmentedChoice({ label, onChange, options, value }: ChoiceFieldProps) {
  const handleChange = useSegmentChange(onChange);

  return (
    <ToggleGroup aria-label={label} className={SEGMENT_TRACK} onValueChange={handleChange} value={[value]}>
      {options.map((option) => (
        <SegmentOption key={option.value} option={option} />
      ))}
    </ToggleGroup>
  );
}

function ListOption({ option }: { readonly option: ChoiceOption }) {
  return (
    <Select.Item
      className="grid cursor-default select-none grid-cols-[1rem_1fr] items-center gap-2 rounded-lg py-2 pr-4 pl-2.5 text-ink text-sm outline-none data-highlighted:bg-dawn-soft"
      value={option.value}
    >
      <Select.ItemIndicator className="col-start-1 text-ink">
        <Check aria-hidden="true" size={14} strokeWidth={2.4} />
      </Select.ItemIndicator>

      <Select.ItemText className="col-start-2">{option.label}</Select.ItemText>
    </Select.Item>
  );
}

function ListChoice({ label, onChange, options, value }: ChoiceFieldProps) {
  const handleChange = useListChange(onChange);

  return (
    <Select.Root items={options} onValueChange={handleChange} value={value}>
      <Select.Trigger
        aria-label={label}
        className="flex h-9 w-full items-center justify-between gap-3 rounded-full bg-white/60 px-4 text-ink text-sm outline-none ring-1 ring-ink/8 ring-inset transition-colors hover:bg-white/80 focus-visible:ring-2 focus-visible:ring-dawn"
      >
        <Select.Value />

        <Select.Icon className="text-ink-muted">
          <ChevronsUpDown aria-hidden="true" size={14} />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Positioner className="z-50 select-none outline-none" sideOffset={6}>
          <Select.Popup className="min-w-(--anchor-width) origin-(--transform-origin) rounded-2xl bg-white/95 p-1 outline-none backdrop-blur-xl transition-[scale,opacity] duration-100 data-ending-style:scale-95 data-starting-style:scale-95 data-ending-style:opacity-0 data-starting-style:opacity-0">
            <Select.List className="max-h-(--available-height) overflow-y-auto">
              {options.map((option) => (
                <ListOption key={option.value} option={option} />
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}

function ChoiceControl(props: ChoiceFieldProps) {
  if (props.options.length <= SEGMENTED_LIMIT) {
    return <SegmentedChoice {...props} />;
  }

  return <ListChoice {...props} />;
}

export function ChoiceField(props: ChoiceFieldProps) {
  const { className, description, label } = props;

  return (
    <div className={cn("flex flex-col gap-2", className)} title={description}>
      <span className="font-medium text-ink text-sm">{label}</span>

      <ChoiceControl {...props} />
    </div>
  );
}
