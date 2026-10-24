import { afterEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { POWERS, powersInCategory } from "../../content/powers.ts";
import { PowerDock } from "./power-dock.tsx";
import { usePowerStore } from "./power-store.ts";

const initialState = usePowerStore.getState();

const ELEMENT_POWERS = ["Fire", "Lightning", "Rain", "Snow", "Explosion", "Meteor", "Earthquake"] as const;
const LAND_POWERS = ["Raise land", "Lower land", "Flatten", "Smooth", "Forest", "Paint ground"] as const;
const LIFE_POWERS = powersInCategory("life").map((powerId) => POWERS[powerId].name);

describe("power dock", () => {
  afterEach(() => {
    usePowerStore.setState(initialState, true);
    localStorage.clear();
  });

  it("shows every power in one row, grouped by kind, with Select first", async () => {
    const screen = await render(<PowerDock />);

    const row = screen.getByRole("toolbar", { name: "Powers" });
    const buttons = row.getByRole("button").elements();

    expect(buttons[0]?.getAttribute("aria-label")).toBe("Select");
    expect(buttons).toHaveLength(1 + ELEMENT_POWERS.length + LAND_POWERS.length + LIFE_POWERS.length);

    await Promise.all(
      [
        { name: "Elements", powers: ELEMENT_POWERS },
        { name: "Land", powers: LAND_POWERS },
        { name: "Life", powers: LIFE_POWERS },
      ].flatMap((group) =>
        group.powers.map((name) =>
          expect
            .element(row.getByRole("group", { name: group.name }).getByRole("button", { exact: true, name }))
            .toBeInTheDocument()
        )
      )
    );
  });

  it("keeps the observing tools out of the dock", async () => {
    const screen = await render(<PowerDock />);

    await expect.element(screen.getByRole("group", { name: "Observe" })).not.toBeInTheDocument();
    await expect.element(screen.getByRole("button", { exact: true, name: "Inspect" })).not.toBeInTheDocument();
  });

  it("shows icons alone and names each power in its tooltip", async () => {
    const screen = await render(<PowerDock />);

    const rain = screen.getByRole("button", { exact: true, name: "Rain" });

    expect(rain.element().textContent).toBe("");

    await rain.hover();

    await expect.element(screen.getByText(POWERS.rain.description)).toBeVisible();
  });

  it("moves between the tiles with the arrow keys", async () => {
    const screen = await render(<PowerDock />);

    const select = screen.getByRole("button", { exact: true, name: "Select" });

    select.element().focus();
    await userEvent.keyboard("{ArrowRight}");

    await expect.element(screen.getByRole("button", { exact: true, name: "Fire" })).toHaveFocus();
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
