import { afterEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { defaultPowerParameters } from "../../content/powers.ts";
import type { PowerSelection } from "../../game/tools/power-tool.ts";
import { connectPowers } from "./connect-powers.ts";
import { usePowerStore } from "./power-store.ts";

const initialState = usePowerStore.getState();

function connectSpy() {
  const selectPower = vi.fn<(selection: PowerSelection | null) => void>();

  const disconnect = connectPowers({ selectPower });

  onTestFinished(disconnect);

  return { disconnect, selectPower };
}

function pressEscape(): void {
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
}

describe("connecting powers to the engine", () => {
  afterEach(() => {
    usePowerStore.setState(initialState, true);
    localStorage.clear();
  });

  it("hands the current choice to the engine at once", () => {
    usePowerStore.getState().selectPower("rain");

    const { selectPower } = connectSpy();

    expect(selectPower).toHaveBeenCalledExactlyOnceWith({
      parameters: defaultPowerParameters("rain"),
      powerId: "rain",
    });
  });

  it("hands every new choice with its parameters to the engine", () => {
    const { selectPower } = connectSpy();

    usePowerStore.getState().selectPower("fire");
    usePowerStore.getState().setParameter("fire", "intensity", 80);

    expect(selectPower).toHaveBeenLastCalledWith({
      parameters: { ...defaultPowerParameters("fire"), intensity: 80 },
      powerId: "fire",
    });
  });

  it("tells the engine when no power is chosen", () => {
    const { selectPower } = connectSpy();

    usePowerStore.getState().selectPower("fire");
    usePowerStore.getState().selectPower(null);

    expect(selectPower).toHaveBeenLastCalledWith(null);
  });

  it("puts the power away when Escape is pressed", () => {
    connectSpy();

    usePowerStore.getState().selectPower("lightning");
    pressEscape();

    expect(usePowerStore.getState().selectedPowerId).toBeNull();
  });

  it("stops listening after disconnecting", () => {
    const { disconnect, selectPower } = connectSpy();

    disconnect();
    usePowerStore.getState().selectPower("fire");
    pressEscape();

    expect(selectPower).toHaveBeenCalledOnce();
    expect(usePowerStore.getState().selectedPowerId).toBe("fire");
  });
});
