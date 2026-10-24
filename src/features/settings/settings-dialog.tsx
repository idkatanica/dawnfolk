import { Dialog } from "@base-ui/react/dialog";
import { ScrollArea } from "@base-ui/react/scroll-area";
import { Tabs } from "@base-ui/react/tabs";
import { X } from "lucide-react";
import type { ComponentType } from "react";
import { useLaunchStore } from "../../app/launch-store.ts";
import { IconButton } from "../../design/buttons.tsx";
import { cn } from "../../design/cn.ts";
import { Island } from "../../design/island.tsx";
import { SEGMENT, SEGMENT_TRACK } from "../../design/segmented.ts";
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
    <Tabs.Tab className={cn(SEGMENT, "h-8 flex-1 text-sm")} value={section.value}>
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
  const worldName = useLaunchStore((state) => state.launch.name);

  function changeTab(value: unknown): void {
    if (isSettingsTab(value)) {
      setTab(value);
    }
  }

  return { changeTab, isOpen, setOpen, tab, worldName };
}

export function SettingsDialog() {
  const { changeTab, isOpen, setOpen, tab, worldName } = useSettingsDialog();

  return (
    <Dialog.Root onOpenChange={setOpen} open={isOpen}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-ink/12 transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />

        <Dialog.Viewport className="fixed inset-0 z-50 flex items-center justify-center px-3 pt-(--dialog-inset-top) pb-(--dialog-inset-bottom)">
          <Dialog.Popup className="w-dialog outline-none transition-[scale,opacity] duration-200 ease-glide data-ending-style:scale-97 data-starting-style:scale-97 data-ending-style:opacity-0 data-starting-style:opacity-0">
            <Island className="max-h-dialog" frost="dense">
              <Tabs.Root className="flex max-h-[inherit] flex-col" onValueChange={changeTab} value={tab}>
                <header className="flex items-start justify-between gap-4 px-5 pt-5 pb-4 sm:px-6">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <Dialog.Title className="font-semibold text-ink text-lg leading-tight">Settings</Dialog.Title>

                    <Dialog.Description className="text-ink-soft text-sm">
                      Shape how the world of {worldName} behaves.
                    </Dialog.Description>
                  </div>

                  <Dialog.Close
                    render={
                      <IconButton
                        className="-mt-1.5 -mr-2 pointer-coarse:size-10 size-9"
                        icon={<X aria-hidden="true" size={18} />}
                        label="Close settings"
                      />
                    }
                  />
                </header>

                <div className="px-5 pb-3 sm:px-6">
                  <Tabs.List aria-label="Settings sections" className={SEGMENT_TRACK}>
                    {SECTIONS.map((section) => (
                      <SectionTab key={section.value} section={section} />
                    ))}
                  </Tabs.List>
                </div>

                <ScrollArea.Root className="relative flex min-h-0 flex-auto flex-col">
                  <ScrollArea.Viewport className="scroll-fade min-h-0 flex-auto overscroll-contain px-5 pt-2 pb-5 outline-none sm:px-6">
                    {SECTIONS.map((section) => (
                      <SectionPanel key={section.value} section={section} />
                    ))}
                  </ScrollArea.Viewport>

                  <ScrollArea.Scrollbar className="mr-1 mb-4 w-1 rounded-full opacity-0 transition-opacity data-hovering:opacity-100 data-scrolling:opacity-100">
                    <ScrollArea.Thumb className="w-full rounded-full bg-ink/25" />
                  </ScrollArea.Scrollbar>
                </ScrollArea.Root>
              </Tabs.Root>
            </Island>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
