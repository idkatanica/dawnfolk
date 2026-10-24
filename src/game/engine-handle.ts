import type { CameraState, GroundPoint } from "./camera/god-camera.ts";
import type { GameSession } from "./game-session.ts";
import type { LabelPlacement } from "./label-projector.ts";
import type { Landmark } from "./landmarks.ts";
import type { PowerSelection } from "./tools/power-tool.ts";

interface EngineCamera {
  readonly groundFootprint: (reach: number) => readonly GroundPoint[];
  readonly state: CameraState;
}

export interface EngineHandle {
  readonly camera: EngineCamera;
  readonly clearSelection: () => void;
  readonly focusOn: (x: number, z: number, distance?: number | null) => void;
  readonly followSelection: () => void;
  readonly landmarks: readonly Landmark[];
  readonly placeLabel: (x: number, z: number, lift: number) => LabelPlacement | null;
  readonly selectPower: (selection: PowerSelection | null) => void;
  readonly session: GameSession;
  readonly stopFollowing: () => void;
  readonly subscribeToRenders: (listener: () => void) => () => void;
}
