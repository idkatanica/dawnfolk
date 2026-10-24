import { useEngine } from "../../app/use-engine.ts";
import type { Inspection } from "../../simulation/inspection.ts";
import { type JournalTab, useInterfaceStore } from "../interface/interface-store.ts";
import { useWorldStore } from "../world/world-store.ts";

export type SidePanelView = "card" | "closed" | "journal";

function viewOf(inspection: Inspection | null, isJournalOpen: boolean): SidePanelView {
  if (inspection !== null) {
    return "card";
  }

  if (isJournalOpen) {
    return "journal";
  }

  return "closed";
}

function useSelectedInspection(): Inspection | null {
  const inspection = useWorldStore((state) => state.snapshot?.inspection);

  if (inspection === undefined) {
    return null;
  }

  return inspection;
}

export function useSidePanel() {
  const engine = useEngine();
  const inspection = useSelectedInspection();
  const isJournalOpen = useInterfaceStore((state) => state.isJournalOpen);
  const journalTab = useInterfaceStore((state) => state.journalTab);
  const showJournal = useInterfaceStore((state) => state.openJournal);
  const hideJournal = useInterfaceStore((state) => state.closeJournal);

  function clearSelection(): void {
    if (engine !== null) {
      engine.clearSelection();
    }
  }

  function close(): void {
    clearSelection();
    hideJournal();
  }

  function openJournal(tab: JournalTab): void {
    if (inspection !== null) {
      clearSelection();
    }

    showJournal(tab);
  }

  function toggleJournal(): void {
    if (isJournalOpen) {
      close();

      return;
    }

    openJournal(journalTab);
  }

  return {
    back: clearSelection,
    close,
    inspection,
    isJournalOpen,
    openJournal,
    toggleJournal,
    view: viewOf(inspection, isJournalOpen),
  };
}
