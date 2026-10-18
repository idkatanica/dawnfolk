import { Switch } from "@base-ui/react/switch";
import { useId } from "react";
import { cn } from "./cn.ts";

export interface ToggleFieldProps {
  readonly className?: string | undefined;
  readonly description?: string | undefined;
  readonly isChecked: boolean;
  readonly label: string;
  readonly onChange: (isChecked: boolean) => void;
}

export function ToggleField({ className, description, isChecked, label, onChange }: ToggleFieldProps) {
  const labelId = useId();

  return (
    <div className={cn("flex min-h-9 items-center justify-between gap-3 text-sm", className)} title={description}>
      <span className="font-medium text-ink" id={labelId}>
        {label}
      </span>

      <Switch.Root
        aria-labelledby={labelId}
        checked={isChecked}
        className="flex h-6 w-10 shrink-0 rounded-full bg-ink/15 p-0.5 outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-dawn focus-visible:ring-offset-1 data-checked:bg-dawn"
        onCheckedChange={onChange}
      >
        <Switch.Thumb className="size-5 rounded-full bg-white shadow-thumb transition-transform duration-150 ease-glide data-checked:translate-x-4" />
      </Switch.Root>
    </div>
  );
}
