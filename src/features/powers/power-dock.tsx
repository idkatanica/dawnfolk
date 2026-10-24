import { Tabs } from "@base-ui/react/tabs";
import { MousePointer2 } from "lucide-react";
import { POWER_CATEGORIES, POWERS, type PowerCategory, type PowerId, powersInCategory } from "../../content/powers.ts";
import { cn } from "../../design/cn.ts";
import { GameIcon } from "../../design/game-icon.tsx";
import { Island } from "../../design/island.tsx";
import { SEGMENT, SEGMENT_TRACK } from "../../design/segmented.ts";
import { WithTooltip } from "../../design/tooltip.tsx";
import { POWER_ICONS } from "./power-icons.tsx";
import { usePowerStore } from "./power-store.ts";

const DOCK_CATEGORIES = POWER_CATEGORIES.filter((category) => category.id !== "observe");

const TILE_CLASS =
  "flex h-16 w-19 shrink-0 flex-col items-center justify-center gap-1.5 rounded-2xl text-ink-soft outline-none transition-colors duration-150 hover:bg-veil hover:text-ink focus-visible:ring-2 focus-visible:ring-dawn pointer-coarse:h-17";

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

  return (
    <WithTooltip content={power.description}>
      <button
        aria-pressed={isSelected}
        className={cn(TILE_CLASS, {
          "bg-white/80 text-ink ring-1 ring-dawn/60 hover:bg-white": isSelected,
        })}
        onClick={toggle}
        type="button"
      >
        <GameIcon name={POWER_ICONS[powerId]} size={34} />

        <span className="max-w-full truncate px-1 font-medium text-2xs leading-none tracking-tight">{power.name}</span>
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
        className={cn(TILE_CLASS, { "bg-white text-ink shadow-segment hover:bg-white": isSelecting })}
        onClick={clearPower}
        type="button"
      >
        <span className="grid size-8.5 place-items-center">
          <MousePointer2 aria-hidden="true" size={22} strokeWidth={1.9} />
        </span>

        <span className="font-medium text-2xs leading-none">Select</span>
      </button>
    </WithTooltip>
  );
}

function CategoryTab({ category }: { readonly category: (typeof DOCK_CATEGORIES)[number] }) {
  return (
    <Tabs.Tab className={cn(SEGMENT, "px-3.5")} value={category.id}>
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
  return <div aria-hidden="true" className="w-px shrink-0 self-stretch bg-line" />;
}

function useCategory() {
  const category = usePowerStore((state) => state.category);
  const setCategory = usePowerStore((state) => state.setCategory);

  return { category, setCategory };
}

export function PowerDock() {
  const { category, setCategory } = useCategory();

  return (
    <Island className="max-w-full">
      <Tabs.Root className="flex flex-col gap-2 p-2" onValueChange={setCategory} value={category}>
        <Tabs.List aria-label="Kinds of powers" className={cn(SEGMENT_TRACK, "self-center")}>
          {DOCK_CATEGORIES.map((entry) => (
            <CategoryTab category={entry} key={entry.id} />
          ))}
        </Tabs.List>

        <div className="scrollbar-none flex gap-2 overflow-x-auto">
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
