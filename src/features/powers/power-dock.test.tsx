import { afterEach, describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { PowerDock } from "./power-dock.tsx";
import { usePowerStore } from "./power-store.ts";

const initialState = usePowerStore.getState();

const ELEMENT_POWERS = ["Fire", "Lightning", "Rain", "Snow", "Explosion", "Meteor", "Earthquake"] as const;
const LAND_POWERS = ["Raise land", "Lower land", "Flatten", "Smooth", "Forest", "Paint ground"] as const;

describe("power dock", () => {
  afterEach(() => {
    usePowerStore.setState(initialState, true);
    localStorage.clear();
  });

  it("opens on the elements", async () => {
    const screen = await render(<PowerDock />);

    await expect.element(screen.getByRole("tab", { name: "Elements" })).toHaveAttribute("aria-selected", "true");

    await Promise.all(
      ELEMENT_POWERS.map((name) => expect.element(screen.getByRole("button", { exact: true, name })).toBeVisible())
    );
  });

  it("keeps the observing tools out of the dock", async () => {
    const screen = await render(<PowerDock />);

    expect(screen.getByRole("tab").elements()).toHaveLength(3);
    await expect.element(screen.getByRole("tab", { name: "Observe" })).not.toBeInTheDocument();
  });

  it("switches the category through its tabs", async () => {
    const screen = await render(<PowerDock />);

    await screen.getByRole("tab", { name: "Land" }).click();

    expect(usePowerStore.getState().category).toBe("land");

    await Promise.all(
      LAND_POWERS.map((name) => expect.element(screen.getByRole("button", { exact: true, name })).toBeVisible())
    );

    await expect.element(screen.getByRole("button", { exact: true, name: "Fire" })).not.toBeInTheDocument();
  });

  it("opens on the category kept in the store", async () => {
    usePowerStore.getState().setCategory("life");

    const screen = await render(<PowerDock />);

    await expect.element(screen.getByRole("tab", { name: "Life" })).toHaveAttribute("aria-selected", "true");
    await expect.element(screen.getByRole("button", { exact: true, name: "Tribe" })).toBeVisible();
  });

  it("selects a power and puts it away when selected again", async () => {
    const screen = await render(<PowerDock />);

    const fire = screen.getByRole("button", { exact: true, name: "Fire" });

    await fire.click();

    expect(usePowerStore.getState().selectedPowerId).toBe("fire");
    await expect.element(fire).toHaveAttribute("aria-pressed", "true");

    await fire.click();

    expect(usePowerStore.getState().selectedPowerId).toBeNull();
    await expect.element(fire).toHaveAttribute("aria-pressed", "false");
  });

  it("switches from one power to another", async () => {
    const screen = await render(<PowerDock />);

    await screen.getByRole("button", { exact: true, name: "Fire" }).click();
    await screen.getByRole("button", { exact: true, name: "Rain" }).click();

    expect(usePowerStore.getState().selectedPowerId).toBe("rain");
    await expect
      .element(screen.getByRole("button", { exact: true, name: "Fire" }))
      .toHaveAttribute("aria-pressed", "false");
  });

  it("puts the power away with the Select tile", async () => {
    usePowerStore.getState().selectPower("fire");

    const screen = await render(<PowerDock />);

    const select = screen.getByRole("button", { exact: true, name: "Select" });

    await expect.element(select).toHaveAttribute("aria-pressed", "false");

    await select.click();

    expect(usePowerStore.getState().selectedPowerId).toBeNull();
    await expect.element(select).toHaveAttribute("aria-pressed", "true");
  });
});
