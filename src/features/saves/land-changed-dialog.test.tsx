import { afterEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import { useEngineStore } from "../../app/engine-store.ts";
import { useLaunchStore } from "../../app/launch-store.ts";
import { GameSession } from "../../game/game-session.ts";
import { LocalSimulationConnection } from "../../game/testing/local-session.ts";
import { DEFAULT_WORLD_REQUEST } from "../../generation/generation-options.ts";
import { ignore } from "../../shared/ignore.ts";
import { Simulation } from "../../simulation/simulation.ts";
import { createVegetatedWorld } from "../../simulation/testing/test-world.ts";
import { createSimulationWorkerApi } from "../../workers/simulation-worker-api.ts";
import { startTestEngine } from "../testing/engine-fixtures.ts";
import { LandChangedDialog } from "./land-changed-dialog.tsx";
import { useSavesStore } from "./saves-store.ts";

const TEST_DIMENSIONS = { cellSize: 10, cellsPerSide: 64 };

const initialSaves = useSavesStore.getState();

function islandAt(height: number): Simulation {
  return new Simulation(
    createVegetatedWorld({
      dimensions: TEST_DIMENSIONS,
      heightAt: () => {
        return height;
      },
    })
  );
}

function loadedSession(regrownHeight: number): Promise<GameSession> {
  const api = createSimulationWorkerApi(() => {
    return islandAt(100);
  });

  api.createWorld(DEFAULT_WORLD_REQUEST, ignore);

  const saved = api.saveWorld();

  if (saved === null) {
    throw new Error("The test world was busy");
  }

  const connection = new LocalSimulationConnection(
    createSimulationWorkerApi(
      () => {
        return islandAt(regrownHeight);
      },
      () => {
        return islandAt(regrownHeight);
      }
    )
  );

  return GameSession.load(connection, saved);
}

async function showLoadedWorld(regrownHeight: number) {
  const { engine } = await startTestEngine();
  const session = await loadedSession(regrownHeight);
  const send = vi.spyOn(session, "send");

  useEngineStore.setState({ status: { engine: { ...engine, session }, kind: "ready" } });
  await render(<LandChangedDialog />);

  return { send, session };
}

afterEach(() => {
  useSavesStore.setState(initialSaves, true);
});

describe("the land changed dialog", () => {
  it("stays away when the land grows as it did", async () => {
    const { send } = await showLoadedWorld(100);

    expect(page.getByRole("alertdialog")).not.toBeInTheDocument();
    expect(send).not.toHaveBeenCalled();
  });

  it("pauses a world whose land changed and plays on when asked", async () => {
    const { send, session } = await showLoadedWorld(140);

    await expect.element(page.getByRole("alertdialog", { name: "The land has changed" })).toBeVisible();
    expect(send).toHaveBeenCalledWith({ isPaused: true, type: "setPaused" });

    await page.getByRole("button", { name: "Play on" }).click();

    await expect.element(page.getByRole("alertdialog")).not.toBeInTheDocument();
    expect(send).toHaveBeenLastCalledWith({ isPaused: false, type: "setPaused" });
    expect(useSavesStore.getState().acceptedLand).toBe(session);
  });

  it("grows the same seed anew as another world", async () => {
    const { launch, worldId } = useLaunchStore.getState();

    await showLoadedWorld(140);
    await page.getByRole("button", { name: "Grow anew" }).click();

    expect(useLaunchStore.getState().worldId).not.toBe(worldId);
    expect(useLaunchStore.getState().launch).toMatchObject({
      name: launch.name,
      seed: launch.seed,
      shape: launch.shape,
    });
  });
});
