import { type Mock, type MockInstance, vi } from "vitest";
import { useEngineStore } from "../../app/engine-store.ts";
import type { EngineHandle } from "../../game/engine-handle.ts";
import { GameSession } from "../../game/game-session.ts";
import type { LabelPlacement } from "../../game/label-projector.ts";
import type { Landmark } from "../../game/landmarks.ts";
import { LocalSimulationConnection } from "../../game/simulation-connection.ts";
import type { PowerSelection } from "../../game/tools/power-tool.ts";
import type { CameraState } from "../../rendering/camera/god-camera.ts";
import type { SimulationCommand } from "../../simulation/commands.ts";
import { Simulation } from "../../simulation/simulation.ts";
import { createVegetatedWorld } from "../../simulation/testing/test-world.ts";
import { createSimulationWorkerApi, DEFAULT_WORLD_REQUEST } from "../../workers/simulation-worker-api.ts";

interface TestEngine {
  readonly clearSelection: Mock<() => void>;
  readonly engine: EngineHandle;
  readonly focusOn: Mock<(x: number, z: number, distance?: number | null) => void>;
  readonly followSelection: Mock<() => void>;
  readonly placeLabel: Mock<(x: number, z: number, lift: number) => LabelPlacement | null>;
  readonly renderFrame: () => void;
  readonly send: MockInstance<(command: SimulationCommand) => void>;
  readonly stopFollowing: Mock<() => void>;
}

interface TestEngineOptions {
  readonly cameraDistance?: number;
  readonly landmarks?: readonly Landmark[];
}

const TEST_CAMERA: CameraState = { distance: 300, pitch: 0.6, targetX: 0, targetZ: 0, yaw: 0.8 };

function createTestSession(): Promise<GameSession> {
  const simulation = new Simulation(createVegetatedWorld({ dimensions: { cellSize: 10, cellsPerSide: 64 } }));

  const connection = new LocalSimulationConnection(createSimulationWorkerApi(() => simulation));

  return GameSession.create(connection, DEFAULT_WORLD_REQUEST);
}

export async function startTestEngine(options: TestEngineOptions = {}): Promise<TestEngine> {
  const { cameraDistance = TEST_CAMERA.distance, landmarks = [] } = options;

  const session = await createTestSession();
  const renderListeners = new Set<() => void>();

  const send = vi.spyOn(session, "send");
  const clearSelection = vi.fn<() => void>();
  const focusOn = vi.fn<(x: number, z: number, distance?: number | null) => void>();
  const followSelection = vi.fn<() => void>();
  const placeLabel = vi.fn<(x: number, z: number, lift: number) => LabelPlacement | null>(() => null);
  const stopFollowing = vi.fn<() => void>();

  function subscribeToRenders(listener: () => void): () => void {
    renderListeners.add(listener);

    return () => {
      renderListeners.delete(listener);
    };
  }

  function renderFrame(): void {
    for (const listener of renderListeners) {
      listener();
    }
  }

  const engine: EngineHandle = {
    camera: { groundFootprint: () => [], state: { ...TEST_CAMERA, distance: cameraDistance } },
    clearSelection,
    focusOn,
    followSelection,
    landmarks,
    placeLabel,
    selectPower: vi.fn<(selection: PowerSelection | null) => void>(),
    session,
    stopFollowing,
    subscribeToRenders,
  };

  useEngineStore.setState({ status: { engine, kind: "ready" } });

  return {
    clearSelection,
    engine,
    focusOn,
    followSelection,
    placeLabel,
    renderFrame,
    send,
    stopFollowing,
  };
}

export function stopTestEngine(): void {
  useEngineStore.setState({ status: { kind: "loading", progress: null } });
}
