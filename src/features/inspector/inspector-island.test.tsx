import { afterEach, describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import type { Inspection, TribeInspection } from "../../simulation/inspection.ts";
import { startTestEngine, stopTestEngine } from "../testing/engine-fixtures.ts";
import {
  createAnimalInspection,
  createBuildingInspection,
  createCellInspection,
  createPersonInspection,
  createTribe,
  resetWorld,
  showWorld,
} from "../testing/world-fixtures.ts";
import { InspectorIsland } from "./inspector-island.tsx";
import { useInspectorStore } from "./inspector-store.ts";

const initialInspectorState = useInspectorStore.getState();

const FOLLOW_LABEL = "Follow with the camera";

function createTribeInspection(isMigrating: boolean): TribeInspection {
  return { kind: "tribe", summary: createTribe({ isMigrating }) };
}

function renderInspection(inspection: Inspection) {
  showWorld({ inspection });

  return render(<InspectorIsland />);
}

describe("inspector island", () => {
  afterEach(() => {
    resetWorld();
    useInspectorStore.setState(initialInspectorState, true);
  });

  it("stays empty before the first frame arrives", async () => {
    const screen = await render(<InspectorIsland />);

    expect(screen.container).toBeEmptyDOMElement();
  });

  it("stays empty while nothing is selected", async () => {
    showWorld({ inspection: null });

    const screen = await render(<InspectorIsland />);

    expect(screen.container).toBeEmptyDOMElement();
  });

  it("titles a person with their name, age and tribe", async () => {
    const screen = await renderInspection(createPersonInspection());

    await expect.element(screen.getByRole("heading", { level: 2, name: "Esk" })).toBeVisible();
    await expect.element(screen.getByText("Man, 26 · Bear Clan")).toBeVisible();
    await expect.element(screen.getByRole("region", { name: "Selection details" })).toBeVisible();
  });

  it.each([
    { age: 7, isFemale: true, subtitle: "Girl, 7 · Bear Clan" },
    { age: 9, isFemale: false, subtitle: "Boy, 9 · Bear Clan" },
    { age: 34, isFemale: true, subtitle: "Woman, 34 · Bear Clan" },
    { age: 63, isFemale: true, subtitle: "Elder woman, 63 · Bear Clan" },
    { age: 70, isFemale: false, subtitle: "Elder man, 70 · Bear Clan" },
  ])("describes a person aged $age as “$subtitle”", async ({ age, isFemale, subtitle }) => {
    const screen = await renderInspection(createPersonInspection({ age, isFemale }));

    await expect.element(screen.getByText(subtitle)).toBeVisible();
  });

  it.each([
    { inspection: createAnimalInspection(), subtitle: "Wild animal", title: "Deer" },
    { inspection: createAnimalInspection({ isYoung: true }), subtitle: "Young animal", title: "Deer" },
    { inspection: createBuildingInspection(), subtitle: "Bear Clan", title: "Campfire" },
    { inspection: createCellInspection(), subtitle: "-120, 341", title: "Broadleaf forest" },
    { inspection: createTribeInspection(false), subtitle: "Settled", title: "Bear Clan" },
    { inspection: createTribeInspection(true), subtitle: "On the move", title: "Bear Clan" },
  ])("titles a $inspection.kind as “$title” with “$subtitle”", async ({ inspection, subtitle, title }) => {
    const screen = await renderInspection(inspection);

    await expect.element(screen.getByRole("heading", { level: 2, name: title })).toBeVisible();
    await expect.element(screen.getByText(subtitle, { exact: true })).toBeVisible();
  });

  it.each([{ inspection: createPersonInspection() }, { inspection: createAnimalInspection() }])(
    "lets the camera follow a $inspection.kind",
    async ({ inspection }) => {
      const screen = await renderInspection(inspection);

      await expect
        .element(screen.getByRole("button", { exact: true, name: FOLLOW_LABEL }))
        .toHaveAttribute("aria-pressed", "false");
    }
  );

  it.each([
    { inspection: createBuildingInspection() },
    { inspection: createCellInspection() },
    { inspection: createTribeInspection(false) },
  ])("has nothing to follow for a $inspection.kind", async ({ inspection }) => {
    const screen = await renderInspection(inspection);

    await expect.element(screen.getByRole("button", { exact: true, name: "Close" })).toBeVisible();
    await expect.element(screen.getByRole("button", { exact: true, name: FOLLOW_LABEL })).not.toBeInTheDocument();
  });

  it("shows that the camera follows the selection", async () => {
    useInspectorStore.getState().setFollowing(true);

    const screen = await renderInspection(createPersonInspection());

    await expect
      .element(screen.getByRole("button", { exact: true, name: FOLLOW_LABEL }))
      .toHaveAttribute("aria-pressed", "true");
  });

  it("does not start following while no game is running", async () => {
    const screen = await renderInspection(createPersonInspection());

    await screen.getByRole("button", { exact: true, name: FOLLOW_LABEL }).click();

    expect(useInspectorStore.getState().isFollowing).toBe(false);
  });

  it("stops following when closed, even while no game is running", async () => {
    useInspectorStore.getState().setFollowing(true);

    const screen = await renderInspection(createPersonInspection());

    await screen.getByRole("button", { exact: true, name: "Close" }).click();

    expect(useInspectorStore.getState().isFollowing).toBe(false);
  });
});

describe("inspector island in a running game", () => {
  afterEach(() => {
    stopTestEngine();
    resetWorld();
    useInspectorStore.setState(initialInspectorState, true);
  });

  it("follows the selected person with the camera and stops again", async () => {
    const { followSelection, stopFollowing } = await startTestEngine();

    const screen = await renderInspection(createPersonInspection());

    const follow = screen.getByRole("button", { exact: true, name: FOLLOW_LABEL });

    await follow.click();

    expect(followSelection).toHaveBeenCalledOnce();
    await expect.element(follow).toHaveAttribute("aria-pressed", "true");

    await follow.click();

    expect(stopFollowing).toHaveBeenCalledOnce();
    await expect.element(follow).toHaveAttribute("aria-pressed", "false");
  });

  it("clears the selection when closed", async () => {
    const { clearSelection } = await startTestEngine();

    const screen = await renderInspection(createAnimalInspection());

    await screen.getByRole("button", { exact: true, name: "Close" }).click();

    expect(clearSelection).toHaveBeenCalledOnce();
  });
});
