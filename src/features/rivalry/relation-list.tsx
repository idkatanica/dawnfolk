import { ArrowRight } from "lucide-react";
import { GameIcon } from "../../design/game-icon.tsx";
import type { TribeSummary } from "../../simulation/frame.ts";
import type { RaidView, RelationView } from "../../simulation/society/rivalry/rivalry-system.ts";
import { useFocusCamera } from "../inspector/use-focus-camera.ts";
import { TribeDot } from "../tribes/tribe-dot.tsx";
import { useWorldStore } from "../world/world-store.ts";
import { RelationNote, StanceBadge } from "./rivalry-parts.tsx";
import { byStance, RAID_PHASE_LABELS } from "./stance-looks.ts";

const QUIET_ISLAND = "Every tribe keeps to itself for now. Rivalries grow where lands and hunting grounds meet.";

interface TribePair<Item> {
  readonly first: TribeSummary;
  readonly item: Item;
  readonly second: TribeSummary;
}

function tribePairs<Item>(
  items: readonly Item[],
  tribes: readonly TribeSummary[],
  idsOf: (item: Item) => readonly [number, number]
): TribePair<Item>[] {
  const pairs: TribePair<Item>[] = [];

  for (const item of items) {
    const [firstId, secondId] = idsOf(item);

    const first = tribes.find((tribe) => tribe.id === firstId);
    const second = tribes.find((tribe) => tribe.id === secondId);

    if (first !== undefined && second !== undefined) {
      pairs.push({ first, item, second });
    }
  }

  return pairs;
}

function useShowSpot(x: number, z: number) {
  const focus = useFocusCamera();

  return () => focus(x, z);
}

function RaidRow({ entry }: { readonly entry: TribePair<RaidView> }) {
  const { first: attacker, item: raid, second: defender } = entry;

  const showCamp = useShowSpot(defender.campX, defender.campZ);

  return (
    <li>
      <button
        className="flex w-full items-center gap-3 rounded-2xl bg-ember-soft p-2.5 text-left outline-none transition-colors hover:bg-ember/20 focus-visible:ring-2 focus-visible:ring-dawn"
        onClick={showCamp}
        type="button"
      >
        <GameIcon name="raid" size={24} />

        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate font-semibold text-ink text-sm">
            {attacker.name} <ArrowRight aria-hidden="true" className="inline text-ink-soft" size={13} /> {defender.name}
          </span>

          <span className="truncate text-ink-soft text-xs">{RAID_PHASE_LABELS[raid.phase]}</span>
        </span>

        <span className="flex flex-col items-end gap-0.5">
          <span className="font-semibold text-ink text-lg tabular-nums leading-none">{raid.raiders}</span>

          <span className="text-ink-muted text-xs">warriors</span>
        </span>
      </button>
    </li>
  );
}

function RelationRow({ entry }: { readonly entry: TribePair<RelationView> }) {
  const { first, item: relation, second } = entry;

  const showBorder = useShowSpot((first.campX + second.campX) / 2, (first.campZ + second.campZ) / 2);

  return (
    <li>
      <button
        className="flex w-full items-center gap-3 rounded-2xl p-2.5 text-left outline-none transition-colors hover:bg-paper-hover focus-visible:ring-2 focus-visible:ring-dawn"
        onClick={showBorder}
        type="button"
      >
        <span className="flex shrink-0 gap-0.5">
          <TribeDot color={first.color} />

          <TribeDot color={second.color} />
        </span>

        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate font-semibold text-ink text-sm">{`${first.name} · ${second.name}`}</span>

          <RelationNote relation={relation} />
        </span>

        <StanceBadge stance={relation.stance} />
      </button>
    </li>
  );
}

function RaidSection({ entries }: { readonly entries: readonly TribePair<RaidView>[] }) {
  if (entries.length === 0) {
    return null;
  }

  return (
    <section aria-label="Raids under way" className="flex flex-col gap-1">
      <h3 className="px-2.5 font-semibold text-ink-soft text-xs uppercase tracking-wide">Raids under way</h3>

      <ul className="flex flex-col gap-1">
        {entries.map((entry) => (
          <RaidRow entry={entry} key={entry.item.id} />
        ))}
      </ul>
    </section>
  );
}

export function RelationList() {
  const rivalry = useWorldStore((state) => state.snapshot?.rivalry);
  const tribes = useWorldStore((state) => state.snapshot?.tribes);

  if (rivalry === undefined || tribes === undefined || rivalry.relations.length === 0) {
    return <p className="p-3 text-ink-muted text-sm">{QUIET_ISLAND}</p>;
  }

  const relations = rivalry.relations.toSorted(byStance);

  return (
    <div className="flex flex-col gap-3">
      <RaidSection entries={tribePairs(rivalry.raids, tribes, (raid) => [raid.attackerId, raid.defenderId])} />

      <ul aria-label="Relations" className="flex flex-col gap-0.5">
        {tribePairs(relations, tribes, (relation) => [relation.firstId, relation.secondId]).map((entry) => (
          <RelationRow entry={entry} key={`${entry.first.id}-${entry.second.id}`} />
        ))}
      </ul>
    </div>
  );
}
