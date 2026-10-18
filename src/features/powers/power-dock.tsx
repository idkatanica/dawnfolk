import { Tabs } from "@base-ui/react/tabs";
import { MousePointer2 } from "lucide-react";
import { POWER_CATEGORIES, POWERS, type PowerCategory, type PowerId, powersInCategory } from "../../content/powers.ts";
import { cn } from "../../design/cn.ts";
import { Island } from "../../design/island.tsx";
import { WithTooltip } from "../../design/tooltip.tsx";
import { POWER_ICONS } from "./power-icons.tsx";
import { usePowerStore } from "./power-store.ts";

const DOCK_CATEGORIES = POWER_CATEGORIES.filter((category) => category.id !== "observe");

const TILE_CLASS =
  "flex h-16 w-19 shrink-0 flex-col items-center justify-center gap-1 rounded-2xl text-ink-soft outline-none transition-colors duration-150 hover:bg-veil hover:text-ink focus-visible:ring-2 focus-visible:ring-dawn pointer-coarse:h-17";

function usePowerSelection(powerId: PowerId) {
  const isSelected = usePowerStore((state) => state.selectedPowerId === powerId);
  const selectPower = usePowerStore((state) => state.selectPower);

  function toggle(): void {
    selectPower(isSelected ? null : powerId);
  }

  return { isSelected, toggle };
}

function PowerTile({ powerId }: { readonly powerId: PowerId }) {
  const { isSelected, toggle } = usePowerSelection(powerId);

  const power = POWERS[powerId];
  const Icon = POWER_ICONS[powerId];

  return (
    <WithTooltip content={power.description}>
      <button
        aria-pressed={isSelected}
        className={cn(TILE_CLASS, {
          "bg-dawn text-white hover:bg-dawn-strong hover:text-white": isSelected,
        })}
        onClick={toggle}
        type="button"
      >
        <Icon aria-hidden="true" size={22} strokeWidth={1.9} />

        <span className="max-w-full truncate px-1 font-medium text-2xs leading-none">{power.name}</span>
      </button>
    </WithTooltip>
  );
}

function useClearPower() {
  const isSelecting = usePowerStore((state) => state.selectedPowerId === null);
  const selectPower = usePowerStore((state) => state.selectPower);

  function clearPower(): void {
    selectPower(null);
  }

  return { clearPower, isSelecting };
}

function SelectTile() {
  const { clearPower, isSelecting } = useClearPower();

  return (
    <WithTooltip content="Tap people, animals, buildings or land to see their details.">
      <button
        aria-pressed={isSelecting}
        className={cn(TILE_CLASS, { "bg-ink text-white hover:bg-ink hover:text-white": isSelecting })}
        onClick={clearPower}
        type="button"
      >
        <MousePointer2 aria-hidden="true" size={22} strokeWidth={1.9} />

        <span className="font-medium text-2xs leading-none">Select</span>
      </button>
    </WithTooltip>
  );
}

function CategoryTab({ category }: { readonly category: (typeof DOCK_CATEGORIES)[number] }) {
  return (
    <Tabs.Tab
      className="h-7 rounded-full px-3 font-semibold text-ink-muted text-xs uppercase tracking-wider outline-none transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-dawn data-active:bg-white data-active:text-ink"
      value={category.id}
    >
      {category.name}
    </Tabs.Tab>
  );
}

function CategoryPanel({ category }: { readonly category: PowerCategory }) {
  return (
    <Tabs.Panel className="flex gap-1 outline-none" value={category}>
      {powersInCategory(category).map((powerId) => (
        <PowerTile key={powerId} powerId={powerId} />
      ))}
    </Tabs.Panel>
  );
}

function DockDivider() {
  return (
    <div aria-hidden="true" className="flex shrink-0 self-stretch px-1">
      <div className="w-px bg-line" />
    </div>
  );
}

function useCategory() {
  const category = usePowerStore((state) => state.category);
  const setCategory = usePowerStore((state) => state.setCategory);

  return { category, setCategory };
}

export function PowerDock({ className }: { readonly className?: string | undefined }) {
  const { category, setCategory } = useCategory();

  return (
    <Island className={cn("max-w-full", className)}>
      <Tabs.Root className="flex flex-col gap-2 p-2" onValueChange={setCategory} value={category}>
        <Tabs.List aria-label="Kinds of powers" className="flex justify-center gap-1">
          {DOCK_CATEGORIES.map((entry) => (
            <CategoryTab category={entry} key={entry.id} />
          ))}
        </Tabs.List>

        <div className="scrollbar-none flex gap-1 overflow-x-auto">
          <SelectTile />

          <DockDivider />

          {DOCK_CATEGORIES.map((entry) => (
            <CategoryPanel category={entry.id} key={entry.id} />
          ))}
        </div>
      </Tabs.Root>
    </Island>
  );
}
