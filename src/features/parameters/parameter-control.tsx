import type { ParameterField } from "../../content/parameters.ts";
import type { ParameterValue } from "../../content/powers.ts";
import { ChoiceField } from "../../design/choice-field.tsx";
import { formatParameterValue } from "../../design/format.ts";
import { RangeField } from "../../design/range-field.tsx";
import { ToggleField } from "../../design/toggle-field.tsx";

interface ParameterControlProps {
  readonly field: ParameterField;
  readonly onChange: (key: string, value: ParameterValue) => void;
  readonly value: ParameterValue | undefined;
}

function numberOr(value: ParameterValue | undefined, fallback: number): number {
  if (typeof value === "number") {
    return value;
  }

  return fallback;
}

function booleanOr(value: ParameterValue | undefined, fallback: boolean): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  return fallback;
}

function stringOr(value: ParameterValue | undefined, fallback: string): string {
  if (typeof value === "string") {
    return value;
  }

  return fallback;
}

function useParameterChange(key: string, onChange: ParameterControlProps["onChange"]) {
  return (next: ParameterValue) => onChange(key, next);
}

export function ParameterControl({ field, onChange, value }: ParameterControlProps) {
  const { metadata } = field;

  const handleChange = useParameterChange(field.key, onChange);

  switch (metadata.kind) {
    case "choice":
      return (
        <ChoiceField
          description={metadata.description}
          label={metadata.label}
          onChange={handleChange}
          options={metadata.options}
          value={stringOr(value, metadata.defaultValue)}
        />
      );
    case "range": {
      const current = numberOr(value, metadata.defaultValue);

      return (
        <RangeField
          description={metadata.description}
          label={metadata.label}
          maximum={metadata.maximum}
          minimum={metadata.minimum}
          onChange={handleChange}
          step={metadata.step}
          value={current}
          valueText={formatParameterValue(current, metadata.unit, metadata.step)}
        />
      );
    }
    case "toggle":
      return (
        <ToggleField
          description={metadata.description}
          isChecked={booleanOr(value, metadata.defaultValue)}
          label={metadata.label}
          onChange={handleChange}
        />
      );
    default:
      return metadata satisfies never;
  }
}
