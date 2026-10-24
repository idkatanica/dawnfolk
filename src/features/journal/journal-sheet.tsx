import { Drawer } from "@base-ui/react/drawer";
import { useInterfaceStore } from "../interface/interface-store.ts";
import { JournalPanel } from "./journal-panel.tsx";

function useJournalSheet() {
  const isOpen = useInterfaceStore((state) => state.isJournalOpen);
  const closeJournal = useInterfaceStore((state) => state.closeJournal);

  function changeOpen(open: boolean): void {
    if (!open) {
      closeJournal();
    }
  }

  return { changeOpen, isOpen };
}

export function JournalSheet() {
  const { changeOpen, isOpen } = useJournalSheet();

  return (
    <Drawer.Root onOpenChange={changeOpen} open={isOpen}>
      <Drawer.Portal>
        <Drawer.Backdrop className="fixed inset-0 z-40 bg-ink/20 transition-opacity duration-300 data-ending-style:opacity-0 data-starting-style:opacity-0" />

        <Drawer.Viewport className="fixed inset-0 z-50 flex items-end">
          <Drawer.Popup className="flex w-full flex-col gap-2 rounded-t-sheet border-paper-edge border-t bg-paper px-3 pt-2 pb-sheet shadow-panel outline-none transition-transform duration-450 ease-glide [transform:translateY(var(--drawer-swipe-movement-y))] data-ending-style:[transform:translateY(100%)] data-starting-style:[transform:translateY(100%)]">
            <div aria-hidden="true" className="h-1 w-10 self-center rounded-full bg-ink/20" />

            <Drawer.Content className="flex flex-col gap-2">
              <Drawer.Title className="px-1 font-semibold text-ink text-lg">Journal</Drawer.Title>

              <JournalPanel />
            </Drawer.Content>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
