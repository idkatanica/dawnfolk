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

export function useIsSidePanelOpen(): boolean {
  const hasInspection = useWorldStore((state) => Boolean(state.snapshot?.inspection));
  const isJournalOpen = useInterfaceStore((state) => state.isJournalOpen);

  return hasInspection || isJournalOpen;
}

export function useSidePanel() {
  const engine = useEngine();
  const inspection = useWorldStore((state) => (state.snapshot === null ? null : state.snapshot.inspection));
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
