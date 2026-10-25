import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { startTestEngine } from "../testing/engine-fixtures.ts";
import { createRaid, createRelation, createTribe, showWorld } from "../testing/world-fixtures.ts";
import { RelationList } from "./relation-list.tsx";

const QUIET = "Every tribe keeps to itself for now. Rivalries grow where lands and hunting grounds meet.";

const TRIBES = [
  createTribe({ campX: -400, campZ: 0, id: 1, name: "Bear Clan" }),
  createTribe({ campX: 400, campZ: 0, color: "#3f7cc4", id: 2, name: "Wolf Clan" }),
  createTribe({ campX: 0, campZ: 500, color: "#5f9e4a", id: 3, name: "Elk Clan" }),
];

describe("relation list", () => {
  it("says the island is quiet while no tribes have met", async () => {
    showWorld();

    const screen = await render(<RelationList />);

    await expect.element(screen.getByText(QUIET)).toBeVisible();
  });

  it("lists every pair of tribes with the bitterest first", async () => {
    showWorld({
      rivalry: {
        raids: [],
        relations: [
          createRelation({ firstId: 1, isKin: true, secondId: 3, stance: "friendly", standing: 40 }),
          createRelation({
            feudDays: 3.2,
            firstDeaths: 1,
            firstId: 1,
            secondDeaths: 1,
            secondId: 2,
            stance: "hostile",
          }),
          createRelation({ firstId: 2, isTruce: true, secondId: 3, stance: "neutral" }),
        ],
      },
      tribes: TRIBES,
    });

    const screen = await render(<RelationList />);

    const rows = screen.getByRole("listitem").elements();

    expect(rows.map((row) => row.textContent)).toEqual([
      "Bear Clan · Wolf ClanFeud for 3 d · 2 fallenHostile",
      "Wolf Clan · Elk ClanTruceNeutral",
      "Bear Clan · Elk ClanKinFriendly",
    ]);
  });

  it("shows the raids under way and flies to the camp under attack", async () => {
    const { focusOn } = await startTestEngine();

    showWorld({
      rivalry: {
        raids: [createRaid({ attackerId: 2, defenderId: 1, phase: "assault", raiders: 5 })],
        relations: [createRelation({ firstId: 1, secondId: 2, stance: "hostile" })],
      },
      tribes: TRIBES,
    });

    const screen = await render(<RelationList />);

    const raids = screen.getByRole("region", { name: "Raids under way" });

    await expect.element(raids.getByText("Fighting at the camp")).toBeVisible();
    await expect.element(raids.getByText("5", { exact: true })).toBeVisible();

    await raids.getByRole("button").click();

    expect(focusOn).toHaveBeenCalledWith(-400, 0, expect.any(Number));
  });
});
