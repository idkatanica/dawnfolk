import { afterEach, describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import { useInterfaceStore } from "../interface/interface-store.ts";
import { createAnimalInspection, resetWorld, showWorld } from "../testing/world-fixtures.ts";
import { JournalSheet } from "./journal-sheet.tsx";

const initialInterfaceState = useInterfaceStore.getState();

describe("journal sheet", () => {
  afterEach(() => {
    resetWorld();
    useInterfaceStore.setState(initialInterfaceState, true);
  });

  it("stays closed while the journal is closed and nothing is selected", async () => {
    showWorld();

    await render(<JournalSheet />);

    expect(page.getByRole("dialog").elements()).toHaveLength(0);
  });

  it("carries the journal", async () => {
    showWorld();
    useInterfaceStore.getState().openJournal("chronicle");

    await render(<JournalSheet />);

    const sheet = page.getByRole("dialog", { name: "Journal" });

    await expect.element(sheet).toBeVisible();
    await expect.element(sheet.getByRole("tab", { name: "Chronicle" })).toHaveAttribute("aria-selected", "true");
  });

  it("carries the card of what is selected on the island", async () => {
    showWorld({ inspection: createAnimalInspection() });

    await render(<JournalSheet />);

    const sheet = page.getByRole("dialog", { name: "Deer" });

    await expect.element(sheet).toBeVisible();
    await expect.element(sheet.getByRole("region", { name: "Selection details" })).toBeVisible();
    await expect.element(sheet.getByRole("button", { name: "Back to the journal" })).not.toBeInTheDocument();
  });

  it("shows the way back to the journal over a card opened from it", async () => {
    showWorld({ inspection: createAnimalInspection() });
    useInterfaceStore.getState().openJournal("tribes");

    await render(<JournalSheet />);

    const sheet = page.getByRole("dialog", { name: "Deer" });

    await expect.element(sheet.getByRole("button", { name: "Back to the journal" })).toBeVisible();
    await expect.element(sheet.getByRole("region", { name: "Journal" })).not.toBeInTheDocument();
  });
});
