import { useInterfaceStore } from "../interface/interface-store.ts";
import { saveBeforeLeaving } from "./saves-store.ts";

export function useLeaveWorld(): (leave: () => void) => void {
  const setSettingsOpen = useInterfaceStore((state) => state.setSettingsOpen);

  return (leave) => {
    setSettingsOpen(false);
    saveBeforeLeaving(leave);
  };
}
