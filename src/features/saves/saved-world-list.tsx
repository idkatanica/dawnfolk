import { ChevronRight, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useLaunchStore } from "../../app/launch-store.ts";
import { IconButton, TextButton } from "../../design/buttons.tsx";
import { cn } from "../../design/cn.ts";
import { Island } from "../../design/island.tsx";
import type { SavedWorldListing } from "./save-database.ts";
import { describeSummary, formatSavedAt } from "./saved-time.ts";
import { useSavesStore } from "./saves-store.ts";
import { useNow } from "./use-now.ts";

const CLOCK_MILLISECONDS = 30_000;

interface SavedWorldRowProps {
  readonly now: number;
  readonly world: SavedWorldListing;
}

function worldDetails(world: SavedWorldListing): string {
  if (!world.isLoadable || world.summary === null) {
    return "Saved by another version of Dawnfolk";
  }

  return describeSummary(world.summary);
}

function useSavedWorldRow(world: SavedWorldListing) {
  const [isConfirming, setConfirming] = useState(false);
  const continueWorld = useLaunchStore((state) => state.continueWorld);
  const remove = useSavesStore((state) => state.remove);

  function askToDelete(): void {
    setConfirming(true);
  }

  function keep(): void {
    setConfirming(false);
  }

  function confirmDelete(): void {
    remove(world.id).catch(() => undefined);
  }

  function open(): void {
    continueWorld(world.id, world);
  }

  return { askToDelete, confirmDelete, isConfirming, keep, open };
}

function SavedWorldRow({ now, world }: SavedWorldRowProps) {
  const { askToDelete, confirmDelete, isConfirming, keep, open } = useSavedWorldRow(world);

  if (isConfirming) {
    return (
      <div className="flex min-h-14 items-center justify-between gap-3 px-3 py-2">
        <p className="min-w-0 truncate text-ink text-sm">Delete {world.name}?</p>

        <div className="flex shrink-0 items-center gap-1">
          <TextButton className="h-8 px-3" onClick={keep} tone="quiet">
            Keep
          </TextButton>

          <TextButton
            className="h-8 bg-ember px-3 text-white hover:bg-ember/90 hover:text-white"
            onClick={confirmDelete}
            tone="quiet"
          >
            Delete
          </TextButton>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 pr-1">
      <button
        className={cn(
          "flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2 text-left outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-dawn",
          "enabled:hover:bg-paper-hover disabled:cursor-not-allowed disabled:opacity-60"
        )}
        disabled={!world.isLoadable}
        onClick={open}
        type="button"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-baseline justify-between gap-3">
            <span className="truncate font-medium text-ink text-sm">{world.name}</span>

            <span className="shrink-0 text-ink-soft text-xs">{formatSavedAt(world.savedAt, now)}</span>
          </span>

          <span className="truncate text-ink-soft text-xs">{worldDetails(world)}</span>
        </span>

        {world.isLoadable ? <ChevronRight aria-hidden="true" className="shrink-0 text-ink-soft" size={16} /> : null}
      </button>

      <IconButton
        className="size-9"
        icon={<Trash2 aria-hidden="true" size={16} />}
        label={`Delete ${world.name}`}
        onClick={askToDelete}
      />
    </div>
  );
}

export function SavedWorldList() {
  const worlds = useSavesStore((state) => state.worlds);
  const refresh = useSavesStore((state) => state.refresh);
  const now = useNow(CLOCK_MILLISECONDS);

  useEffect(() => {
    refresh().catch(() => undefined);
  }, [refresh]);

  if (worlds.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="saved-worlds-title" className="w-full">
      <Island className="flex flex-col gap-2 p-4">
        <h2 className="px-2 pt-1 font-semibold text-ink text-xl" id="saved-worlds-title">
          Your worlds
        </h2>

        <ul className="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
          {worlds.map((world) => (
            <li key={world.id}>
              <SavedWorldRow now={now} world={world} />
            </li>
          ))}
        </ul>
      </Island>
    </section>
  );
}
