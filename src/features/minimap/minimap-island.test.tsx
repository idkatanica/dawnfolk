import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { useInterfaceStore } from "../interface/interface-store.ts";
import { startTestEngine } from "../testing/engine-fixtures.ts";
import { MinimapIsland } from "./minimap-island.tsx";

const MAP_NAME = "Map of the island. Click to move the camera.";

describe("minimap island", () => {
  it("stays hidden before the game is running", async () => {
    useInterfaceStore.setState({ isMapOpen: true });

    const screen = await render(<MinimapIsland />);

    expect(screen.container).toBeEmptyDOMElement();
  });

  it("stays hidden while the map is closed", async () => {
    await startTestEngine();

    useInterfaceStore.setState({ isMapOpen: false });

    const screen = await render(<MinimapIsland />);

    expect(screen.container).toBeEmptyDOMElement();
  });

  it("moves the camera to the clicked point", async () => {
    const { engine, focusOn } = await startTestEngine();

    useInterfaceStore.setState({ isMapOpen: true });

    const screen = await render(<MinimapIsland />);

    await screen.getByRole("img", { name: MAP_NAME }).click({ position: { x: 132, y: 44 } });

    const { grid } = engine.session.mirror;

    const [target] = focusOn.mock.calls;

    if (target === undefined) {
      throw new Error("Expected the camera to move");
    }

    const [x, z] = target;

    expect(x).toBeCloseTo((132 / 176) * grid.worldSize - grid.halfSize, -1);
    expect(z).toBeCloseTo((44 / 176) * grid.worldSize - grid.halfSize, -1);
  });
});
