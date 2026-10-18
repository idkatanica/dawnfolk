import { Footprints } from "lucide-react";
import type { TribeSummary } from "../../simulation/frame.ts";
import { useWorldStore } from "../world/world-store.ts";
import { useShowTribe } from "./use-focus-camera.ts";

function MigrationMark({ tribe }: { readonly tribe: TribeSummary }) {
  if (!tribe.isMigrating) {
    return null;
  }

  return (
    <span className="flex items-center gap-1 text-ink-muted text-xs">
      <Footprints aria-hidden="true" size={12} />
      On the move
    </span>
  );
}

function TribeCard({ tribe }: { readonly tribe: TribeSummary }) {
  const showTribe = useShowTribe(tribe);

  return (
    <li>
      <button
        className="flex w-full items-center gap-3 rounded-2xl p-2.5 text-left outline-none transition-colors hover:bg-veil focus-visible:ring-2 focus-visible:ring-dawn"
        onClick={showTribe}
        type="button"
      >
        <span
          aria-hidden="true"
          className="size-9 shrink-0 rounded-xl shadow-thumb"
          style={{ backgroundColor: tribe.color }}
        />

        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate font-semibold text-ink text-sm">{tribe.name}</span>

          <span className="truncate text-ink-muted text-xs">{tribe.eraName}</span>

          <MigrationMark tribe={tribe} />
        </span>

        <span className="flex flex-col items-end gap-0.5">
          <span className="tabular font-semibold text-ink text-lg leading-none">{tribe.population}</span>

          <span className="text-ink-muted text-xs">people</span>
        </span>
      </button>
    </li>
  );
}

export function TribeList() {
  const tribes = useWorldStore((state) => state.snapshot?.tribes);

  if (tribes === undefined || tribes.length === 0) {
    return <p className="p-3 text-ink-muted text-sm">No tribes live on the island. Bring one with the Tribe power.</p>;
  }

  return (
    <ul className="flex flex-col gap-0.5">
      {tribes.map((tribe) => (
        <TribeCard key={tribe.id} tribe={tribe} />
      ))}
    </ul>
  );
}
