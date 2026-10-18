import type { BuildingCount } from "../../simulation/frame.ts";
import { BUILDING_ICONS } from "./tribe-icons.ts";

export function BuildingList({ buildings }: { readonly buildings: readonly BuildingCount[] }) {
  if (buildings.length === 0) {
    return <p className="text-ink-muted text-xs">Nothing is built yet.</p>;
  }

  return (
    <ul aria-label="Buildings" className="flex flex-wrap gap-1.5">
      {buildings.map((building) => {
        const Icon = BUILDING_ICONS[building.kind];

        return (
          <li
            className="inline-flex h-6 items-center gap-1.5 rounded-full bg-ink/8 px-2.5 font-medium text-ink-soft text-xs"
            key={building.kind}
          >
            <Icon aria-hidden="true" size={13} />

            <span>{building.count > 1 ? `${building.name} ×${building.count}` : building.name}</span>
          </li>
        );
      })}
    </ul>
  );
}
