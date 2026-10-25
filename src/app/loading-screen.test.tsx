import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { GameSession } from "../game/game-session.ts";
import { LocalSimulationConnection } from "../game/simulation-connection.ts";
import { DEFAULT_WORLD_REQUEST } from "../generation/generation-options.ts";
import { Simulation } from "../simulation/simulation.ts";
import { createVegetatedWorld } from "../simulation/testing/test-world.ts";
import { createSimulationWorkerApi } from "../workers/simulation-worker-api.ts";
import { reportStop } from "./engine-launcher.ts";
import { useEngineStore } from "./engine-store.ts";
import { useLaunchStore } from "./launch-store.ts";
import { LoadingScreen } from "./loading-screen.tsx";

async function startFailingSession(failure: Error): Promise<GameSession> {
  const simulation = new Simulation(createVegetatedWorld({ dimensions: { cellSize: 10, cellsPerSide: 64 } }));

  const connection = new LocalSimulationConnection(createSimulationWorkerApi(() => simulation));
  const session = await GameSession.create(connection, DEFAULT_WORLD_REQUEST);

  vi.spyOn(simulation, "advance").mockImplementation(() => {
    throw failure;
  });

  return session;
}

describe("loading screen", () => {
  it("says why the island could not rise", async () => {
    useEngineStore.setState({ status: { kind: "failed", message: "WebGPU is not available" } });

    const screen = await render(<LoadingScreen />);

    await expect.element(screen.getByRole("alert").getByText("The island could not rise")).toBeVisible();
    await expect.element(screen.getByText("WebGPU is not available")).toBeVisible();
  });

  it("tells the player when the simulation stops and starts the world again", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const session = await startFailingSession(new Error("The worker crashed"));

    const { launch } = useLaunchStore.getState();

    reportStop(session, useEngineStore.getState().setStatus);
    session.update(1);
    await session.whenIdle();

    const screen = await render(<LoadingScreen />);

    await expect.element(screen.getByRole("alert").getByText("The simulation stopped")).toBeVisible();
    await expect.element(screen.getByText("The worker crashed")).toBeVisible();

    await screen.getByRole("button", { name: "Start again" }).click();

    expect(useLaunchStore.getState().launch).not.toBe(launch);
    expect(useLaunchStore.getState().launch.seed).toBe(launch.seed);
  });
});
