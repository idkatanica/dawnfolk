import { GameIcon } from "../../design/game-icon.tsx";
import type { ChronicleEntry } from "../../simulation/chronicle.ts";
import { useWorldStore } from "../world/world-store.ts";
import { CHRONICLE_ICONS } from "./chronicle-icons.ts";
import { useFocusCamera } from "./use-focus-camera.ts";

const SHOWN_ENTRIES = 120;

function useShowPlace(entry: ChronicleEntry) {
  const focus = useFocusCamera();

  return () => focus(entry.x, entry.z);
}

function ChronicleItem({ entry }: { readonly entry: ChronicleEntry }) {
  const showPlace = useShowPlace(entry);

  return (
    <li>
      <button
        className="flex w-full items-start gap-3 rounded-xl px-2.5 py-2 text-left outline-none transition-colors hover:bg-paper-hover focus-visible:ring-2 focus-visible:ring-dawn"
        onClick={showPlace}
        type="button"
      >
        <GameIcon name={CHRONICLE_ICONS[entry.category]} size={24} />

        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-ink text-sm leading-snug">{entry.text}</span>

          <span className="text-ink-muted text-xs">Day {Math.floor(entry.day) + 1}</span>
        </span>
      </button>
    </li>
  );
}

export function ChronicleList() {
  const chronicle = useWorldStore((state) => state.chronicle);

  const latest = chronicle.slice(-SHOWN_ENTRIES).toReversed();

  if (latest.length === 0) {
    return <p className="p-3 text-ink-muted text-sm">Nothing has happened yet. The story begins at dawn.</p>;
  }

  return (
    <ol>
      {latest.map((entry) => (
        <ChronicleItem entry={entry} key={entry.id} />
      ))}
    </ol>
  );
}
