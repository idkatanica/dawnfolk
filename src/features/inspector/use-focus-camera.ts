import { useEngine } from "../../app/use-engine.ts";
import type { Selection } from "../../simulation/commands.ts";
import type { TribeSummary } from "../../simulation/frame.ts";
import { useInspectorStore } from "./inspector-store.ts";

const FOCUS_DISTANCE = 260;

export function useFocusCamera() {
  const engine = useEngine();
  const setFollowing = useInspectorStore((state) => state.setFollowing);

  function focus(x: number, z: number, selection: Selection | null = null): void {
    if (engine === null) {
      return;
    }

    engine.stopFollowing();
    setFollowing(false);
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
