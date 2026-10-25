import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { useInterfaceStore } from "../interface/interface-store.ts";
import { createChronicleEntry, createRelation, showWorld } from "../testing/world-fixtures.ts";
import { useWorldStore } from "../world/world-store.ts";
import { JournalPanel } from "./journal-panel.tsx";

function showJournalContent() {
  showWorld();
  useWorldStore.setState({ chronicle: [createChronicleEntry({ text: "The Bear Clan arrives on the island." })] });
}

describe("journal panel", () => {
  it("opens on the tribes", async () => {
    showJournalContent();

    const screen = await render(<JournalPanel />);

    await expect.element(screen.getByRole("tab", { name: "Tribes" })).toHaveAttribute("aria-selected", "true");
    await expect.element(screen.getByText("Bear Clan", { exact: true })).toBeVisible();
    await expect.element(screen.getByText("The Bear Clan arrives on the island.")).not.toBeInTheDocument();
  });

  it("opens on the tab kept in the interface store", async () => {
    showJournalContent();
    useInterfaceStore.getState().setJournalTab("chronicle");

    const screen = await render(<JournalPanel />);

    await expect.element(screen.getByRole("tab", { name: "Chronicle" })).toHaveAttribute("aria-selected", "true");
    await expect.element(screen.getByText("The Bear Clan arrives on the island.")).toBeVisible();
  });

  it("switches tabs through the interface store", async () => {
    showJournalContent();

    const screen = await render(<JournalPanel />);

    await screen.getByRole("tab", { name: "Chronicle" }).click();

    expect(useInterfaceStore.getState().journalTab).toBe("chronicle");
    await expect.element(screen.getByText("The Bear Clan arrives on the island.")).toBeVisible();
    await expect.element(screen.getByText("Bear Clan", { exact: true })).not.toBeInTheDocument();
  });

  it("shows how the tribes stand with each other", async () => {
    showWorld({ rivalry: { raids: [], relations: [createRelation({ stance: "hostile" })] } });

    const screen = await render(<JournalPanel />);

    await screen.getByRole("tab", { name: "Relations" }).click();

    expect(useInterfaceStore.getState().journalTab).toBe("relations");
    await expect.element(screen.getByText("Bear Clan · Wolf Clan")).toBeVisible();
    await expect.element(screen.getByText("Hostile")).toBeVisible();
  });

  it("follows tab changes made elsewhere", async () => {
    showJournalContent();

    const screen = await render(<JournalPanel />);

    useInterfaceStore.getState().openJournal("chronicle");

    await expect.element(screen.getByRole("tab", { name: "Chronicle" })).toHaveAttribute("aria-selected", "true");
  });
});
