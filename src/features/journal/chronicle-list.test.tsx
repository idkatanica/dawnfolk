import { afterEach, describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { createChronicleEntry, resetWorld } from "../testing/world-fixtures.ts";
import { useWorldStore } from "../world/world-store.ts";
import { ChronicleList } from "./chronicle-list.tsx";

const SHOWN_ENTRIES = 120;

function createEntries(count: number) {
  return Array.from({ length: count }, (_, index) =>
    createChronicleEntry({ day: index / 4, id: index + 1, text: `Event ${index + 1}` })
  );
}

describe("chronicle list", () => {
  afterEach(() => {
    resetWorld();
  });

  it("says that nothing has happened yet", async () => {
    const screen = await render(<ChronicleList />);

    await expect.element(screen.getByText("Nothing has happened yet. The story begins at dawn.")).toBeVisible();
  });

  it("shows the newest entries first with the day they happened", async () => {
    useWorldStore.setState({
      chronicle: [
        createChronicleEntry({ day: 0.4, id: 1, text: "The Bear Clan arrives on the island." }),
        createChronicleEntry({ category: "birth", day: 1.2, id: 2, text: "A child is born to the Bear Clan." }),
      ],
    });

    const screen = await render(<ChronicleList />);

    const [newest, oldest] = screen.getByRole("listitem").elements();

    expect(newest).toMatchTextContent("A child is born to the Bear Clan.");
    expect(newest).toMatchTextContent("Day 2");
    expect(oldest).toMatchTextContent("The Bear Clan arrives on the island.");
    expect(oldest).toMatchTextContent("Day 1");
  });

  it(`shows only the latest ${SHOWN_ENTRIES} entries`, async () => {
    useWorldStore.setState({ chronicle: createEntries(SHOWN_ENTRIES + 10) });

    const screen = await render(<ChronicleList />);

    expect(screen.getByRole("listitem").elements()).toHaveLength(SHOWN_ENTRIES);
    await expect.element(screen.getByText("Event 130", { exact: true })).toBeVisible();
    await expect.element(screen.getByText("Event 11", { exact: true })).toBeInTheDocument();
    await expect.element(screen.getByText("Event 10", { exact: true })).not.toBeInTheDocument();
  });

  it("ignores a click on an entry while no game is running", async () => {
    useWorldStore.setState({ chronicle: createEntries(1) });

    const screen = await render(<ChronicleList />);

    const entry = screen.getByRole("button", { exact: false, name: "Event 1" });

    await entry.click();

    await expect.element(entry).toBeVisible();
  });
});
