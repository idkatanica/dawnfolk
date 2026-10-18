import { RESOURCE_GROUPS, RESOURCES, type ResourceGroup, resourcesInGroup } from "../../content/resources.ts";
import type { StockView } from "../../simulation/frame.ts";
import { RESOURCE_ICONS } from "./tribe-icons.ts";

const GROUP_NAMES: Readonly<Record<ResourceGroup, string>> = {
  arms: "Arms",
  food: "Food",
  material: "Materials",
  metal: "Metals",
  ore: "Ores",
};

function StockGroup({ group, stock }: { readonly group: ResourceGroup; readonly stock: StockView }) {
  const kinds = resourcesInGroup(group).filter((kind) => Math.round(stock[kind]) > 0);

  if (kinds.length === 0) {
    return null;
  }

  const total = kinds.reduce((sum, kind) => sum + stock[kind], 0);

  return (
    <section aria-label={GROUP_NAMES[group]} className="flex flex-col gap-1">
      <h3 className="flex items-baseline justify-between text-2xs text-ink-muted uppercase tracking-wide">
        <span>{GROUP_NAMES[group]}</span>

        <span className="tabular-nums">{Math.round(total)}</span>
      </h3>

      <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
        {kinds.map((kind) => {
          const Icon = RESOURCE_ICONS[kind];

          return (
            <li className="flex min-w-0 items-center gap-1.5 text-ink-soft" key={kind}>
              <Icon aria-hidden="true" className="shrink-0" size={14} />

              <span className="truncate text-xs">{RESOURCES[kind].name}</span>

              <span className="ml-auto font-medium text-ink text-xs tabular-nums">{Math.round(stock[kind])}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function StockList({ stock }: { readonly stock: StockView }) {
  const hasAnything = RESOURCE_GROUPS.some((group) =>
    resourcesInGroup(group).some((kind) => Math.round(stock[kind]) > 0)
  );

  if (!hasAnything) {
    return <p className="text-ink-muted text-xs">The stores are empty.</p>;
  }

  return (
    <div className="flex flex-col gap-2.5">
      {RESOURCE_GROUPS.map((group) => (
        <StockGroup group={group} key={group} stock={stock} />
      ))}
    </div>
  );
}
