import { Dialog } from "@base-ui/react/dialog";
import { ScrollArea } from "@base-ui/react/scroll-area";
import { Tabs } from "@base-ui/react/tabs";
import { X } from "lucide-react";
import type { ComponentType } from "react";
import { IconButton } from "../../design/buttons.tsx";
import { type SettingsTab, useInterfaceStore } from "../interface/interface-store.ts";
import { GraphicsSection } from "./graphics-section.tsx";
import { TimeSection } from "./time-section.tsx";
import { WeatherSection } from "./weather-section.tsx";
import { WorldRulesSection } from "./world-rules-section.tsx";

interface SettingsSection {
  readonly Content: ComponentType;
  readonly label: string;
  readonly value: SettingsTab;
}

const SECTIONS: readonly SettingsSection[] = [
  { Content: WorldRulesSection, label: "World", value: "world" },
  { Content: WeatherSection, label: "Weather", value: "weather" },
  { Content: TimeSection, label: "Time", value: "time" },
  { Content: GraphicsSection, label: "Island", value: "graphics" },
];

function isSettingsTab(value: unknown): value is SettingsTab {
  return SECTIONS.some((section) => section.value === value);
}

function SectionTab({ section }: { readonly section: SettingsSection }) {
  return (
    <Tabs.Tab
      className="h-8 flex-1 rounded-full px-3 font-semibold text-ink-soft text-sm outline-none transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-dawn data-active:bg-white data-active:text-ink"
      value={section.value}
    >
      {section.label}
    </Tabs.Tab>
  );
}

function SectionPanel({ section }: { readonly section: SettingsSection }) {
  const { Content } = section;

  return (
    <Tabs.Panel className="outline-none" value={section.value}>
      <Content />
    </Tabs.Panel>
  );
}

function useSettingsDialog() {
  const isOpen = useInterfaceStore((state) => state.isSettingsOpen);
  const setOpen = useInterfaceStore((state) => state.setSettingsOpen);
  const tab = useInterfaceStore((state) => state.settingsTab);
  const setTab = useInterfaceStore((state) => state.setSettingsTab);

  function changeTab(value: unknown): void {
    if (isSettingsTab(value)) {
      setTab(value);
    }
  }

  return { changeTab, isOpen, setOpen, tab };
}

export function SettingsDialog() {
  const { changeTab, isOpen, setOpen, tab } = useSettingsDialog();

  return (
    <Dialog.Root onOpenChange={setOpen} open={isOpen}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-ink/18 transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />

        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 w-dialog -translate-x-1/2 -translate-y-1/2 outline-none transition-[scale,opacity] duration-200 ease-glide data-ending-style:scale-95 data-starting-style:scale-95 data-ending-style:opacity-0 data-starting-style:opacity-0">
          <div className="w-full rounded-island bg-white/55 ring-1 ring-white/40 backdrop-blur-xl backdrop-saturate-150">
            <Tabs.Root className="flex max-h-dialog flex-col gap-3 p-4" onValueChange={changeTab} value={tab}>
              <header className="flex items-center justify-between gap-3">
                <div className="flex flex-col">
                  <Dialog.Title className="font-semibold text-ink text-xl">Settings</Dialog.Title>

                  <Dialog.Description className="text-ink-muted text-sm">
                    Shape how the world of Dawnfolk behaves.
                  </Dialog.Description>
                </div>

                <Dialog.Close
                  render={<IconButton icon={<X aria-hidden="true" size={18} />} label="Close settings" />}
                />
              </header>

              <Tabs.List aria-label="Settings sections" className="flex gap-1 rounded-full bg-ink/8 p-1">
                {SECTIONS.map((section) => (
                  <SectionTab key={section.value} section={section} />
                ))}
              </Tabs.List>

              <ScrollArea.Root className="relative min-h-0 flex-1">
                <ScrollArea.Viewport className="h-full max-h-dialog-body overscroll-contain pr-2.5 outline-none">
                  {SECTIONS.map((section) => (
                    <SectionPanel key={section.value} section={section} />
                  ))}
                </ScrollArea.Viewport>

                <ScrollArea.Scrollbar className="flex w-1.5 justify-center rounded-full py-1 opacity-0 transition-opacity data-hovering:opacity-100 data-scrolling:opacity-100">
                  <ScrollArea.Thumb className="w-full rounded-full bg-ink/25" />
                </ScrollArea.Scrollbar>
              </ScrollArea.Root>
            </Tabs.Root>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
