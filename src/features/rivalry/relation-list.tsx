import { ArrowRight } from "lucide-react";
import { cn } from "../../design/cn.ts";
import { GameIcon } from "../../design/game-icon.tsx";
import type { TribeSummary } from "../../simulation/frame.ts";
import type { Stance } from "../../simulation/society/rivalry/relations.ts";
import type { RaidView, RelationView } from "../../simulation/society/rivalry/rivalry-system.ts";
import { useFocusCamera } from "../inspector/use-focus-camera.ts";
import { useWorldStore } from "../world/world-store.ts";
import { byStance, RAID_PHASE_LABELS, relationNote, STANCE_LOOKS } from "./stance-looks.ts";

const QUIET_ISLAND = "Every tribe keeps to itself for now. Rivalries grow where lands and hunting grounds meet.";

export function StanceBadge({ stance }: { readonly stance: Stance }) {
  const look = STANCE_LOOKS[stance];

  return (
    <span
      className={cn("inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 font-medium text-xs", look.tone)}
    >
      <GameIcon name={look.icon} size={18} />
      {look.label}
    </span>
  );
}

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

function tribeById(tribes: readonly TribeSummary[], id: number): TribeSummary | null {
  const tribe = tribes.find((candidate) => candidate.id === id);

  if (tribe === undefined) {
    return null;
  }

  return tribe;
}

function raidEntries(raids: readonly RaidView[], tribes: readonly TribeSummary[]): RaidEntry[] {
  const entries: RaidEntry[] = [];

  for (const raid of raids) {
    const attacker = tribeById(tribes, raid.attackerId);
    const defender = tribeById(tribes, raid.defenderId);

    if (attacker !== null && defender !== null) {
      entries.push({ attacker, defender, raid });
    }
  }

  return entries;
}

function relationEntries(relations: readonly RelationView[], tribes: readonly TribeSummary[]): RelationEntry[] {
  const entries: RelationEntry[] = [];

  for (const relation of relations.toSorted(byStance)) {
    const first = tribeById(tribes, relation.firstId);
    const second = tribeById(tribes, relation.secondId);

    if (first !== null && second !== null) {
      entries.push({ first, relation, second });
    }
  }

  return entries;
}

function useShowSpot(x: number, z: number) {
  const focus = useFocusCamera();

  return () => focus(x, z);
}

function TribeDot({ tribe }: { readonly tribe: TribeSummary }) {
  return (
    <span
      aria-hidden="true"
      className="size-3 shrink-0 rounded-full ring-2 ring-white"
      style={{ backgroundColor: tribe.color }}
    />
  );
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

function RelationNote({ relation }: { readonly relation: RelationView }) {
  const note = relationNote(relation);

  if (note === null) {
    return null;
  }

  return <span className="truncate text-ink-muted text-xs">{note}</span>;
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
          <TribeDot tribe={first} />

          <TribeDot tribe={second} />
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
