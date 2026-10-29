import { useInterfaceStore } from "../interface/interface-store.ts";
import { saveBeforeLeaving } from "./saves-store.ts";

export function useLeaveWorld(): (leave: () => void) => void {
  const setSettingsOpen = useInterfaceStore((state) => {
    return state.setSettingsOpen;
  });

  return (leave) => {
    setSettingsOpen(false);
    saveBeforeLeaving(leave);
  };
}
