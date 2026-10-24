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

interface RaidEntry {
  readonly attacker: TribeSummary;
  readonly defender: TribeSummary;
  readonly raid: RaidView;
}

interface RelationEntry {
  readonly first: TribeSummary;
  readonly relation: RelationView;
  readonly second: TribeSummary;
}

function raidEntries(raids: readonly RaidView[], tribes: readonly TribeSummary[]): RaidEntry[] {
  const entries: RaidEntry[] = [];

  for (const raid of raids) {
    const attacker = tribes.find((tribe) => tribe.id === raid.attackerId);
    const defender = tribes.find((tribe) => tribe.id === raid.defenderId);

    if (attacker !== undefined && defender !== undefined) {
      entries.push({ attacker, defender, raid });
    }
  }

  return entries;
}

function relationEntries(relations: readonly RelationView[], tribes: readonly TribeSummary[]): RelationEntry[] {
  const entries: RelationEntry[] = [];

  for (const relation of relations.toSorted(byStance)) {
    const first = tribes.find((tribe) => tribe.id === relation.firstId);
    const second = tribes.find((tribe) => tribe.id === relation.secondId);

    if (first !== undefined && second !== undefined) {
      entries.push({ first, relation, second });
    }
  }

  return entries;
}

function useShowSpot(x: number, z: number) {
  const focus = useFocusCamera();

  return () => focus(x, z);
}

function RaidRow({ entry }: { readonly entry: RaidEntry }) {
  const { attacker, defender, raid } = entry;

  const showCamp = useShowSpot(defender.campX, defender.campZ);

  return (
    <li>
      <button
        className="flex w-full items-center gap-3 rounded-2xl bg-ember-soft p-2.5 text-left text-ember outline-none transition-colors hover:bg-ember/20 focus-visible:ring-2 focus-visible:ring-dawn"
        onClick={showCamp}
        type="button"
      >
        <GameIcon name="raid" size={24} />

        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-1 truncate font-semibold text-ink text-sm">
            {attacker.name}
            <ArrowRight aria-hidden="true" className="shrink-0 text-ink-soft" size={13} />
            {defender.name}
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

function RelationRow({ entry }: { readonly entry: RelationEntry }) {
  const { first, relation, second } = entry;

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

function RaidSection({ entries }: { readonly entries: readonly RaidEntry[] }) {
  if (entries.length === 0) {
    return null;
  }

  return (
    <section aria-label="Raids under way" className="flex flex-col gap-1">
      <h3 className="px-2.5 font-semibold text-ink-soft text-xs uppercase tracking-wide">Raids under way</h3>

      <ul className="flex flex-col gap-1">
        {entries.map((entry) => (
          <RaidRow entry={entry} key={entry.raid.id} />
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

  return (
    <div className="flex flex-col gap-3">
      <RaidSection entries={raidEntries(rivalry.raids, tribes)} />

      <ul aria-label="Relations" className="flex flex-col gap-0.5">
        {relationEntries(rivalry.relations, tribes).map((entry) => (
          <RelationRow entry={entry} key={`${entry.first.id}-${entry.second.id}`} />
        ))}
      </ul>
    </div>
  );
}
