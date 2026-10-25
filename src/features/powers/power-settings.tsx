import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { describeParameters } from "../../content/parameters.ts";
import { type ParameterValue, POWERS, type PowerId } from "../../content/powers.ts";
import { IconButton } from "../../design/buttons.tsx";
import { cn } from "../../design/cn.ts";
import { GameIcon } from "../../design/game-icon.tsx";
import { Island } from "../../design/island.tsx";
import { useIsCompact } from "../../design/use-media-query.ts";
import { ParameterControl } from "../parameters/parameter-control.tsx";
import { POWER_ICONS } from "./power-icons.tsx";
import { usePowerStore, withDefaults } from "./power-store.ts";

const USAGE_HINTS = {
  brush: "Hold and drag over the land.",
  point: "Tap a spot on the island.",
} as const;

function usePowerParameters(powerId: PowerId) {
  const stored = usePowerStore((state) => state.parameters[powerId]);
  const setParameter = usePowerStore((state) => state.setParameter);
  const resetParameters = usePowerStore((state) => state.resetParameters);

  const values = withDefaults(powerId, stored);

  function changeParameter(key: string, value: ParameterValue): void {
    setParameter(powerId, key, value);
  }

  function reset(): void {
    resetParameters(powerId);
  }

  return { changeParameter, reset, values };
}

function useFieldDisclosure() {
  const isCompact = useIsCompact();

  const [isExpanded, setExpanded] = useState(false);

  function toggleFields(): void {
    setExpanded((wasExpanded) => !wasExpanded);
  }

  return { areFieldsShown: !isCompact || isExpanded, isCompact, toggleFields };
}

function PowerSettingsContent({ powerId }: { readonly powerId: PowerId }) {
  const { changeParameter, reset, values } = usePowerParameters(powerId);
  const { areFieldsShown, isCompact, toggleFields } = useFieldDisclosure();

  const power = POWERS[powerId];

  const fields = describeParameters(power.parameters);

  return (
    <section aria-label={`${power.name} settings`} className="flex flex-col gap-3 p-3 md:w-72">
      <header className="flex items-center gap-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-ink/6">
          <GameIcon name={POWER_ICONS[powerId]} size={28} />
        </span>

        <div className="flex min-w-0 flex-1 flex-col">
          <h2 className="truncate font-semibold text-ink text-sm leading-tight">{power.name}</h2>

          <p className="truncate text-ink-muted text-xs" title={power.description}>
            {USAGE_HINTS[power.usage]}
          </p>
        </div>

        {isCompact ? (
          <IconButton
            aria-expanded={areFieldsShown}
            icon={<SlidersHorizontal aria-hidden="true" size={16} />}
            label="Adjust settings"
            onClick={toggleFields}
          />
        ) : null}

        <IconButton icon={<RotateCcw aria-hidden="true" size={16} />} label="Reset to defaults" onClick={reset} />
      </header>

      {areFieldsShown ? (
        <div className={cn("grid gap-3", { "sm:max-md:grid-cols-2": fields.length > 1 })}>
          {fields.map((field) => (
            <ParameterControl field={field} key={field.key} onChange={changeParameter} value={values[field.key]} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function PowerSettings({ className }: { readonly className?: string | undefined }) {
  const powerId = usePowerStore((state) => state.selectedPowerId);

  if (powerId === null) {
    return null;
  }

  return (
    <Island className={className}>
      <PowerSettingsContent powerId={powerId} />
    </Island>
  );
}
