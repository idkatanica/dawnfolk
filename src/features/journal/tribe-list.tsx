import { FOOD_KINDS, RESOURCES, type ResourceKind } from "../../content/resources.ts";
import { GameIcon } from "../../design/game-icon.tsx";
import type { GameIconName } from "../../design/game-icon-sources.ts";
import type { TribeSummary } from "../../simulation/frame.ts";
import { useShowTribe } from "../inspector/use-focus-camera.ts";
import { GoalNeed } from "../tribes/goal-need.tsx";
import { RESOURCE_ICONS } from "../tribes/tribe-icons.ts";
import { useWorldStore } from "../world/world-store.ts";

const SHOWN_METALS: readonly ResourceKind[] = ["iron", "bronze", "copper"];

interface StockHighlight {
  readonly amount: number;
  readonly icon: GameIconName;
  readonly name: string;
}

function MigrationMark({ tribe }: { readonly tribe: TribeSummary }) {
  if (!tribe.isMigrating) {
    return null;
  }

  return (
    <span className="text-ink-muted flex items-center gap-1 text-xs">
      <GameIcon name="migration" size={18} />
      On the move
    </span>
  );
}

function highlights(tribe: TribeSummary): StockHighlight[] {
  const { stock } = tribe;

  const food = FOOD_KINDS.reduce((total, kind) => total + stock[kind], 0);
  const metal = SHOWN_METALS.find((kind) => stock[kind] >= 1);

  const shown: StockHighlight[] = [
    { amount: food, icon: RESOURCE_ICONS.grain, name: "Food" },
    { amount: stock.wood, icon: RESOURCE_ICONS.wood, name: RESOURCES.wood.name },
    { amount: stock.stone, icon: RESOURCE_ICONS.stone, name: RESOURCES.stone.name },
  ];

  if (metal !== undefined) {
    shown.push({ amount: stock[metal], icon: RESOURCE_ICONS[metal], name: RESOURCES[metal].name });
  }

  return shown;
}

function StockLine({ tribe }: { readonly tribe: TribeSummary }) {
  return (
    <span className="text-ink-muted flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs">
      {highlights(tribe).map((highlight) => (
        <span className="flex items-center gap-1 tabular-nums" key={highlight.name} title={highlight.name}>
          <GameIcon name={highlight.icon} size={18} />

          <span className="sr-only">{highlight.name}</span>

          <span>{Math.round(highlight.amount)}</span>
        </span>
      ))}
    </span>
  );
}

function TribeCard({ tribe }: { readonly tribe: TribeSummary }) {
  const showTribe = useShowTribe(tribe);

  return (
    <li>
      <button
        className="hover:bg-paper-hover focus-visible:ring-dawn flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition-colors outline-none focus-visible:ring-2"
        onClick={showTribe}
        type="button"
      >
        <span aria-hidden="true" className="size-9 shrink-0 rounded-xl" style={{ backgroundColor: tribe.color }} />

        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-ink truncate text-sm font-semibold">{tribe.name}</span>

          <span className="text-ink-muted truncate text-xs">{tribe.eraName}</span>

          <StockLine tribe={tribe} />

          <GoalNeed goal={tribe.goal} />

          <MigrationMark tribe={tribe} />
        </span>

        <span className="flex flex-col items-end gap-0.5">
          <span className="text-ink text-lg leading-none font-semibold tabular-nums">{tribe.population}</span>

          <span className="text-ink-muted text-xs">people</span>
        </span>
      </button>
    </li>
  );
}

export function TribeList() {
  const tribes = useWorldStore((state) => state.snapshot?.tribes);

  if (tribes === undefined || tribes.length === 0) {
    return <p className="text-ink-muted p-3 text-sm">No tribes live on the island. Bring one with the Tribe power.</p>;
  }

  return (
    <ul className="flex flex-col gap-0.5">
      {tribes.map((tribe) => (
        <TribeCard key={tribe.id} tribe={tribe} />
      ))}
    </ul>
  );
}
