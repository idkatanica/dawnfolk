import { X } from "lucide-react";
import { IconButton } from "../../design/buttons.tsx";
import { Island } from "../../design/island.tsx";
import { useInterfaceStore } from "../interface/interface-store.ts";
import { JournalPanel } from "./journal-panel.tsx";

export function JournalIsland({ className }: { readonly className?: string | undefined }) {
  const isOpen = useInterfaceStore((state) => state.isJournalOpen);
  const closeJournal = useInterfaceStore((state) => state.closeJournal);

  if (!isOpen) {
    return null;
  }

  return (
    <Island className={className}>
      <section aria-label="Journal" className="flex w-journal flex-col gap-2 p-3">
        <header className="flex items-center justify-between pl-1">
          <h2 className="font-semibold text-ink text-lg">Journal</h2>

          <IconButton icon={<X aria-hidden="true" size={18} />} label="Close the journal" onClick={closeJournal} />
        </header>

        <JournalPanel />
      </section>
    </Island>
  );
}
