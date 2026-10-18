import { afterEach, describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { useInterfaceStore } from "../interface/interface-store.ts";
import { resetWorld, showWorld } from "../testing/world-fixtures.ts";
import { JournalIsland } from "./journal-island.tsx";

const initialInterfaceState = useInterfaceStore.getState();

describe("journal island", () => {
  afterEach(() => {
    resetWorld();
    useInterfaceStore.setState(initialInterfaceState, true);
  });

  it("stays hidden while the journal is closed", async () => {
    const screen = await render(<JournalIsland />);

    expect(screen.container).toBeEmptyDOMElement();
  });

  it("shows the journal with its tabs when opened", async () => {
    showWorld();
    useInterfaceStore.getState().openJournal("tribes");

    const screen = await render(<JournalIsland />);

    await expect.element(screen.getByRole("heading", { level: 2, name: "Journal" })).toBeVisible();
    await expect.element(screen.getByRole("tablist", { name: "Journal" })).toBeVisible();
    await expect.element(screen.getByRole("button", { exact: false, name: "Bear Clan" })).toBeVisible();
  });

  it("closes from its close button", async () => {
    showWorld();
    useInterfaceStore.getState().openJournal("tribes");

    const screen = await render(<JournalIsland />);

    await screen.getByRole("button", { exact: true, name: "Close the journal" }).click();

    expect(useInterfaceStore.getState().isJournalOpen).toBe(false);
    await expect.element(screen.getByRole("heading", { level: 2, name: "Journal" })).not.toBeInTheDocument();
  });
});
