import { Crosshair, X } from "lucide-react";
import { useEngine } from "../../app/use-engine.ts";
import { type AgeGroup, ageGroupOf } from "../../content/life-stages.ts";
import { IconButton } from "../../design/buttons.tsx";
import { GameIcon } from "../../design/game-icon.tsx";
import type { GameIconName } from "../../design/game-icon-sources.ts";
import { Island } from "../../design/island.tsx";
import type { Inspection, PersonInspection } from "../../simulation/inspection.ts";
import { useWorldStore } from "../world/world-store.ts";
import { AnimalDetails, BuildingDetails, CellDetails, PersonDetails, TribeDetails } from "./inspector-details.tsx";
import { useInspectorStore } from "./inspector-store.ts";

const KIND_ICONS: Readonly<Record<Inspection["kind"], GameIconName>> = {
  animal: "paw",
  building: "hut",
  cell: "smooth",
  person: "person",
  tribe: "tent",
};

const PERSON_NOUNS: Readonly<Record<AgeGroup, { readonly female: string; readonly male: string }>> = {
  adult: { female: "Woman", male: "Man" },
  child: { female: "Girl", male: "Boy" },
  elder: { female: "Elder woman", male: "Elder man" },
};

function personNoun(person: PersonInspection): string {
  const nouns = PERSON_NOUNS[ageGroupOf(person.age)];

  return person.isFemale ? nouns.female : nouns.male;
}

function titleOf(inspection: Inspection): string {
  switch (inspection.kind) {
    case "cell":
      return inspection.biomeName;
    case "tribe":
      return inspection.summary.name;
    default:
      return inspection.name;
  }
}

function subtitleOf(inspection: Inspection): string {
  switch (inspection.kind) {
    case "animal":
      return inspection.isYoung ? "Young animal" : "Wild animal";
    case "building":
      return inspection.tribeName;
    case "cell":
      return `${Math.round(inspection.x)}, ${Math.round(inspection.z)}`;
    case "person":
      return `${personNoun(inspection)}, ${inspection.age} · ${inspection.tribeName}`;
    case "tribe":
      return inspection.summary.isMigrating ? "On the move" : "Settled";
    default:
      return inspection satisfies never;
  }
}

function InspectionDetails({ inspection }: { readonly inspection: Inspection }) {
  switch (inspection.kind) {
    case "animal":
      return <AnimalDetails animal={inspection} />;
    case "building":
      return <BuildingDetails building={inspection} />;
    case "cell":
      return <CellDetails cell={inspection} />;
    case "person":
      return <PersonDetails person={inspection} />;
    case "tribe":
      return <TribeDetails tribe={inspection} />;
    default:
      return inspection satisfies never;
  }
}

function isFollowable(inspection: Inspection): boolean {
  return inspection.kind === "person" || inspection.kind === "animal";
}

function useInspectorActions() {
  const engine = useEngine();
  const isFollowing = useInspectorStore((state) => state.isFollowing);
  const setFollowing = useInspectorStore((state) => state.setFollowing);

  function toggleFollowing(): void {
    if (engine === null) {
      return;
    }

    if (isFollowing) {
      engine.stopFollowing();
    } else {
      engine.followSelection();
    }

    setFollowing(!isFollowing);
  }

  function close(): void {
    if (engine !== null) {
      engine.clearSelection();
    }

    setFollowing(false);
  }

  return { close, isFollowing, toggleFollowing };
}

function FollowButton({ inspection }: { readonly inspection: Inspection }) {
  const { isFollowing, toggleFollowing } = useInspectorActions();

  if (!isFollowable(inspection)) {
    return null;
  }

  return (
    <IconButton
      icon={<Crosshair aria-hidden="true" size={17} />}
      isPressed={isFollowing}
      label="Follow with the camera"
      onClick={toggleFollowing}
    />
  );
}

function InspectorContent({ inspection }: { readonly inspection: Inspection }) {
  const { close } = useInspectorActions();

  return (
    <section aria-label="Selection details" className="flex w-full flex-col gap-4 p-4 md:w-80">
      <header className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-ink/6 text-ink-soft">
          <GameIcon name={KIND_ICONS[inspection.kind]} size={30} />
        </span>

        <div className="flex min-w-0 flex-1 flex-col">
          <h2 className="truncate font-semibold text-ink text-lg leading-tight">{titleOf(inspection)}</h2>

          <p className="truncate text-ink-muted text-xs">{subtitleOf(inspection)}</p>
        </div>

        <FollowButton inspection={inspection} />

        <IconButton icon={<X aria-hidden="true" size={18} />} label="Close" onClick={close} />
      </header>

      <InspectionDetails inspection={inspection} />
    </section>
  );
}

export function InspectorIsland({ className }: { readonly className?: string | undefined }) {
  const inspection = useWorldStore((state) => state.snapshot?.inspection);

  if (inspection === undefined || inspection === null) {
    return null;
  }

  return (
    <Island className={className}>
      <InspectorContent inspection={inspection} />
    </Island>
  );
}
