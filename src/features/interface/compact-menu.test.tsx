import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { CompactMenu } from "./compact-menu.tsx";
import { useInterfaceStore } from "./interface-store.ts";

describe("compact menu", () => {
  it("keeps its entries hidden until it is opened", async () => {
    const screen = await render(<CompactMenu />);

    await expect.element(screen.getByRole("button", { name: "Menu" })).toBeVisible();
    expect(screen.getByRole("menu").elements()).toHaveLength(0);
  });

  it("lists the panels it can open", async () => {
    useInterfaceStore.setState({ isMapOpen: false });

    const screen = await render(<CompactMenu />);

    await screen.getByRole("button", { name: "Menu" }).click();

    await expect.element(screen.getByRole("menuitem", { name: "Tribes and chronicle" })).toBeVisible();
    await expect.element(screen.getByRole("menuitem", { name: "Show the map" })).toBeVisible();
    await expect.element(screen.getByRole("menuitem", { name: "Settings" })).toBeVisible();
  });

  it("opens the journal on the tribes", async () => {
    useInterfaceStore.setState({ journalTab: "chronicle" });

    const screen = await render(<CompactMenu />);

    await screen.getByRole("button", { name: "Menu" }).click();
    await screen.getByRole("menuitem", { name: "Tribes and chronicle" }).click();

    const state = useInterfaceStore.getState();

    expect(state.isJournalOpen).toBe(true);
    expect(state.journalTab).toBe("tribes");
  });

  it("shows the map and then offers to hide it", async () => {
    useInterfaceStore.setState({ isMapOpen: false });

    const screen = await render(<CompactMenu />);

    await screen.getByRole("button", { name: "Menu" }).click();
    await screen.getByRole("menuitem", { name: "Show the map" }).click();

    expect(useInterfaceStore.getState().isMapOpen).toBe(true);

    await screen.getByRole("button", { name: "Menu" }).click();

    await expect.element(screen.getByRole("menuitem", { name: "Hide the map" })).toBeVisible();
  });

  it("opens the world settings", async () => {
    const screen = await render(<CompactMenu />);

    await screen.getByRole("button", { name: "Menu" }).click();
    await screen.getByRole("menuitem", { name: "Settings" }).click();

    const state = useInterfaceStore.getState();

    expect(state.isSettingsOpen).toBe(true);
    expect(state.settingsTab).toBe("world");
  });
});
