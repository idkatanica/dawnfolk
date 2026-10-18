import { afterEach, describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { startTestEngine, stopTestEngine } from "../testing/engine-fixtures.ts";
import { createTribe, resetWorld, showWorld } from "../testing/world-fixtures.ts";
import { TribeList } from "./tribe-list.tsx";

const EMPTY_ISLAND = "No tribes live on the island. Bring one with the Tribe power.";

describe("tribe list", () => {
  afterEach(() => {
    resetWorld();
  });

  it("invites to bring a tribe before the first frame arrives", async () => {
    const screen = await render(<TribeList />);

    await expect.element(screen.getByText(EMPTY_ISLAND)).toBeVisible();
  });

  it("invites to bring a tribe while the island is empty", async () => {
    showWorld({ tribes: [] });

    const screen = await render(<TribeList />);

    await expect.element(screen.getByText(EMPTY_ISLAND)).toBeVisible();
    await expect.element(screen.getByRole("list")).not.toBeInTheDocument();
  });

  it("lists every tribe with its era and population", async () => {
    showWorld({
      tribes: [
        createTribe({ eraName: "Wanderers", id: 1, name: "Bear Clan", population: 7 }),
        createTribe({ eraName: "Hunters", id: 2, name: "Wolf Clan", population: 12 }),
      ],
    });

    const screen = await render(<TribeList />);

    const bearClan = screen.getByRole("button", { exact: false, name: "Bear Clan" });
    const wolfClan = screen.getByRole("button", { exact: false, name: "Wolf Clan" });

    expect(screen.getByRole("listitem").elements()).toHaveLength(2);
    await expect.element(bearClan.getByText("Wanderers", { exact: true })).toBeVisible();
    await expect.element(bearClan.getByText("7", { exact: true })).toBeVisible();
    await expect.element(wolfClan.getByText("Hunters", { exact: true })).toBeVisible();
    await expect.element(wolfClan.getByText("12", { exact: true })).toBeVisible();
  });

  it("marks the tribes that are on the move", async () => {
    showWorld({
      tribes: [
        createTribe({ id: 1, isMigrating: true, name: "Bear Clan" }),
        createTribe({ id: 2, isMigrating: false, name: "Wolf Clan" }),
      ],
    });

    const screen = await render(<TribeList />);

    const bearClan = screen.getByRole("button", { exact: false, name: "Bear Clan" });
    const wolfClan = screen.getByRole("button", { exact: false, name: "Wolf Clan" });

    await expect.element(bearClan.getByText("On the move", { exact: true })).toBeVisible();
    await expect.element(wolfClan.getByText("On the move", { exact: true })).not.toBeInTheDocument();
  });

  it("ignores a click on a tribe while no game is running", async () => {
    showWorld();

    const screen = await render(<TribeList />);

    const bearClan = screen.getByRole("button", { exact: false, name: "Bear Clan" });

    await bearClan.click();

    await expect.element(bearClan).toBeVisible();
  });
});

describe("tribe list in a running game", () => {
  afterEach(() => {
    stopTestEngine();
    resetWorld();
  });

  it("flies the camera to the camp and selects the tribe", async () => {
    const { focusOn, send, stopFollowing } = await startTestEngine();

    showWorld({ tribes: [createTribe({ campX: 120, campZ: -40, id: 3, name: "Fox Clan" })] });

    const screen = await render(<TribeList />);

    await screen.getByRole("button", { exact: false, name: "Fox Clan" }).click();

    expect(stopFollowing).toHaveBeenCalledOnce();
    expect(focusOn).toHaveBeenCalledExactlyOnceWith(120, -40, 260);
    expect(send).toHaveBeenCalledExactlyOnceWith({ selection: { id: 3, kind: "tribe" }, type: "setSelection" });
  });
});
