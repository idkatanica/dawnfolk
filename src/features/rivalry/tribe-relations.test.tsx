import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { createRaid, createRelation, createTribe, showWorld } from "../testing/world-fixtures.ts";
import { TribeRelations } from "./tribe-relations.tsx";

describe("tribe relations", () => {
  it("lists the other tribes by how they stand with this one", async () => {
    showWorld({
      rivalry: {
        raids: [createRaid({ attackerId: 2, defenderId: 1, phase: "march" })],
        relations: [
          createRelation({ firstId: 1, isKin: true, secondId: 3, stance: "friendly" }),
          createRelation({ feudDays: 1, firstId: 1, secondId: 2, stance: "hostile" }),
          createRelation({ firstId: 2, secondId: 3, stance: "wary" }),
        ],
      },
      tribes: [
        createTribe({ id: 1, name: "Bear Clan" }),
        createTribe({ id: 2, name: "Wolf Clan" }),
        createTribe({ id: 3, name: "Elk Clan" }),
      ],
    });

    const screen = await render(<TribeRelations tribeId={1} />);

    const neighbors = screen.getByRole("region", { name: "Neighbors" });

    await expect.element(neighbors.getByText("Raided by the Wolf Clan · On the march")).toBeVisible();
    expect(
      neighbors
        .getByRole("listitem")
        .elements()
        .map((item) => item.textContent)
    ).toEqual(["Wolf ClanFeud for 1 dHostile", "Elk ClanKinFriendly"]);
  });

  it("leaves a tribe without neighbors out", async () => {
    showWorld({ rivalry: { raids: [], relations: [] } });

    const screen = await render(<TribeRelations tribeId={1} />);

    await expect.element(screen.getByRole("region", { name: "Neighbors" })).not.toBeInTheDocument();
  });
});
