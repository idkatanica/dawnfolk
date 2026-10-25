import { useEngine } from "../../app/use-engine.ts";
import { useIsCompact } from "../../design/use-media-query.ts";
import type { Selection } from "../../simulation/commands.ts";
import type { TribeSummary } from "../../simulation/frame.ts";
import { useInterfaceStore } from "../interface/interface-store.ts";

const FOCUS_DISTANCE = 260;

export function useFocusCamera() {
  const engine = useEngine();

  function focus(x: number, z: number, selection: Selection | null = null): void {
    if (engine === null) {
      return;
    }

    engine.focusOn(x, z, FOCUS_DISTANCE);

    if (selection !== null) {
      engine.session.send({ selection, type: "setSelection" });
    }
  }

  return focus;
}

export function useShowTribe(tribe: TribeSummary) {
  const focus = useFocusCamera();

  return () => focus(tribe.campX, tribe.campZ, { id: tribe.id, kind: "tribe" });
}

export function useShowSpot(x: number, z: number) {
  const focus = useFocusCamera();
  const isCompact = useIsCompact();
  const closeJournal = useInterfaceStore((state) => state.closeJournal);

  return () => {
    focus(x, z);

    if (isCompact) {
      closeJournal();
    }
  };
}
