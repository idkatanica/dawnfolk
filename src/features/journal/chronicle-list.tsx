import { GameIcon } from "../../design/game-icon.tsx";
import { RowButton } from "../../design/row-button.tsx";
import type { ChronicleEntry } from "../../simulation/chronicle.ts";
import { useShowSpot } from "../inspector/use-focus-camera.ts";
import { useWorldStore } from "../world/world-store.ts";
import { CHRONICLE_ICONS } from "./chronicle-icons.ts";

const SHOWN_ENTRIES = 120;

function ChronicleItem({ entry }: { readonly entry: ChronicleEntry }) {
  const showSpot = useShowSpot(entry.x, entry.z);

  return (
    <RowButton
      className="items-start rounded-xl py-2"
      leading={<GameIcon name={CHRONICLE_ICONS[entry.category]} />}
      onClick={showSpot}
    >
      <span className="text-ink text-sm leading-snug">{entry.text}</span>

      <span className="text-ink-muted text-xs">Day {Math.floor(entry.day) + 1}</span>
    </RowButton>
  );
}

export function ChronicleList() {
  const chronicle = useWorldStore((state) => {
    return state.chronicle;
  });

  const latest = chronicle.slice(-SHOWN_ENTRIES).toReversed();

  if (latest.length === 0) {
    return <p className="text-ink-muted p-3 text-sm">Nothing has happened yet. The story begins at dawn.</p>;
  }

  return (
    <ol>
      {latest.map((entry) => {
        return <ChronicleItem entry={entry} key={entry.id} />;
      })}
    </ol>
  );
}
