import type { EngineHandle } from "../../game/engine-handle.ts";
import type { PowerSelection } from "../../game/tools/power-tool.ts";
import { type PowerStore, parametersOf, usePowerStore } from "./power-store.ts";

function selectionOf(state: PowerStore): PowerSelection | null {
  const { selectedPowerId } = state;

  if (selectedPowerId === null) {
    return null;
  }

  return { parameters: parametersOf(state.parameters, selectedPowerId), powerId: selectedPowerId };
}

function clearOnEscape(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    usePowerStore.getState().selectPower(null);
  }
}

export function connectPowers(engine: Pick<EngineHandle, "selectHand" | "selectPower">): () => void {
  function apply(state: PowerStore): void {
    engine.selectPower(selectionOf(state));
    engine.selectHand(state.isHandSelected);
  }

  apply(usePowerStore.getState());

  const unsubscribe = usePowerStore.subscribe(apply);

  window.addEventListener("keydown", clearOnEscape);

  return () => {
    unsubscribe();
    window.removeEventListener("keydown", clearOnEscape);
  };
}
