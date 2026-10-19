import { ScrollArea } from "@base-ui/react/scroll-area";
import { Tabs } from "@base-ui/react/tabs";
import type { ReactNode } from "react";
import { type JournalTab, useInterfaceStore } from "../interface/interface-store.ts";
import { RelationList } from "../rivalry/relation-list.tsx";
import { ChronicleList } from "./chronicle-list.tsx";
import { TribeList } from "./tribe-list.tsx";

const TABS: readonly { readonly label: string; readonly value: JournalTab }[] = [
  { label: "Tribes", value: "tribes" },
  { label: "Relations", value: "relations" },
  { label: "Chronicle", value: "chronicle" },
];

function isJournalTab(value: unknown): value is JournalTab {
  return TABS.some((tab) => tab.value === value);
}

function JournalTabButton({ label, value }: { readonly label: string; readonly value: JournalTab }) {
  return (
    <Tabs.Tab
      className="h-8 flex-1 rounded-full px-3 font-semibold text-ink-soft text-sm outline-none transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-dawn data-active:bg-white data-active:text-ink"
      value={value}
    >
      {label}
    </Tabs.Tab>
  );
}

function ScrollingPanel({ children, value }: { readonly children: ReactNode; readonly value: JournalTab }) {
  return (
    <Tabs.Panel className="outline-none" value={value}>
      <ScrollArea.Root className="relative">
        <ScrollArea.Viewport className="max-h-journal overscroll-contain pr-2.5 outline-none">
          {children}
        </ScrollArea.Viewport>

        <ScrollArea.Scrollbar className="w-1.5 rounded-full py-1 opacity-0 transition-opacity data-hovering:opacity-100 data-scrolling:opacity-100">
          <ScrollArea.Thumb className="w-full rounded-full bg-ink/25" />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
    </Tabs.Panel>
  );
}

function useJournalTab() {
  const journalTab = useInterfaceStore((state) => state.journalTab);
  const setJournalTab = useInterfaceStore((state) => state.setJournalTab);

  function changeTab(value: unknown): void {
    if (isJournalTab(value)) {
      setJournalTab(value);
    }
  }

  return { changeTab, journalTab };
}

export function JournalPanel() {
  const { changeTab, journalTab } = useJournalTab();

  return (
    <Tabs.Root className="flex flex-col gap-2" onValueChange={changeTab} value={journalTab}>
      <Tabs.List aria-label="Journal" className="flex gap-1 rounded-full bg-ink/8 p-1">
        {TABS.map((tab) => (
          <JournalTabButton key={tab.value} label={tab.label} value={tab.value} />
        ))}
      </Tabs.List>

      <ScrollingPanel value="tribes">
        <TribeList />
      </ScrollingPanel>

      <ScrollingPanel value="relations">
        <RelationList />
      </ScrollingPanel>

      <ScrollingPanel value="chronicle">
        <ChronicleList />
      </ScrollingPanel>
    </Tabs.Root>
  );
}
