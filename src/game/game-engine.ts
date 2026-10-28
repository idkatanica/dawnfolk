import { Matrix4, PerspectiveCamera, type Vector3, type WebGPURenderer } from "three/webgpu";
import type { GenerationProgress, WorldRequest } from "../generation/generation-options.ts";
import { createRenderer } from "../rendering/create-renderer.ts";
import { type QualityLevel, RENDER_QUALITY } from "../rendering/render-quality.ts";
import { WorldRenderer } from "../rendering/world-renderer.ts";
import { clamp } from "../shared/math.ts";
import type { ChronicleEntry } from "../simulation/chronicle.ts";
import type { SavedWorldState } from "../simulation/saved-world.ts";
import { type CameraState, GodCamera } from "./camera/god-camera.ts";
import type { EngineHandle } from "./engine-handle.ts";
import { FramePacer } from "./frame-pacer.ts";
import { GameSession } from "./game-session.ts";
import { EntityPicker } from "./input/entity-picker.ts";
import { GroundPicker, type ScreenPoint, type ViewportSize } from "./input/ground-picker.ts";
import { KeyboardControls } from "./input/keyboard-controls.ts";
import { PointerControls } from "./input/pointer-controls.ts";
import { type LabelPlacement, LabelProjector } from "./label-projector.ts";
import type { Landmark } from "./landmarks.ts";
import { ResolutionGovernor } from "./resolution-governor.ts";
import { type SimulationConnection, WorkerSimulationConnection } from "./simulation-connection.ts";
import { type PowerSelection, PowerTool } from "./tools/power-tool.ts";

export type WorldSource =
  | { readonly kind: "new"; readonly request: WorldRequest }
  | { readonly journal: readonly ChronicleEntry[]; readonly kind: "saved"; readonly state: SavedWorldState };

interface EngineOptions {
  readonly camera: Partial<CameraState>;
  readonly canvas: HTMLCanvasElement;
  readonly onProgress: (progress: GenerationProgress) => void;
  readonly quality: QualityLevel;
  readonly world: WorldSource;
}

interface EngineParts {
  readonly canvas: HTMLCanvasElement;
  readonly quality: QualityLevel;
  readonly renderer: WebGPURenderer;
  readonly session: GameSession;
}

const LONGEST_FRAME_SECONDS = 0.1;
const MILLISECONDS_PER_SECOND = 1000;
const FIELD_OF_VIEW = 45;
const NEAR_PLANE = 0.5;
const FAR_PLANE = 40_000;
const CURSOR_COLOR = 0xff_ff_ff;
const PRESSED_CURSOR_COLOR = 0xff_d8_8a;
const FOLLOW_DISTANCE = 45;
const VIEW_FOCUS_STEP = 50;
const ACTIVITY_EVENTS = ["keydown", "pointerdown", "pointermove", "wheel"] as const;

function openSession(
  connection: SimulationConnection,
  world: WorldSource,
  onProgress: (progress: GenerationProgress) => void
): Promise<GameSession> {
  if (world.kind === "saved") {
    return GameSession.load(connection, world.state, { journal: world.journal, onProgress });
  }

  return GameSession.create(connection, world.request, { onProgress });
}

async function createSessionOrRelease(
  renderer: WebGPURenderer,
  connection: SimulationConnection,
  world: WorldSource,
  onProgress: (progress: GenerationProgress) => void
): Promise<GameSession> {
  try {
    return await openSession(connection, world, onProgress);
  } catch (error) {
    renderer.dispose();
    connection.dispose();

    throw error;
  }
}

export class GameEngine implements EngineHandle {
  readonly camera: GodCamera;
  readonly powers: PowerTool;
  readonly session: GameSession;
  readonly #canvas: HTMLCanvasElement;
  readonly #activity = new AbortController();
  readonly #cameraPlacement = new Matrix4();
  readonly #entityPicker: EntityPicker;
  readonly #keyboard: KeyboardControls;
  readonly #labels: LabelProjector;
  readonly #pacer = new FramePacer();
  readonly #pointer: PointerControls;
  readonly #renderListeners = new Set<() => void>();
  readonly #renderer: WebGPURenderer;
  readonly #resizeObserver: ResizeObserver;
  readonly #resolution: ResolutionGovernor;
  readonly #world: WorldRenderer;
  #devicePixelRatio = 0;
  #reportedFocusX = Number.NaN;
  #reportedFocusZ = Number.NaN;
  #viewport: ViewportSize = { height: 1, width: 1 };

  constructor(parts: EngineParts) {
    this.#canvas = parts.canvas;
    this.#resolution = new ResolutionGovernor(RENDER_QUALITY[parts.quality].maximumPixelRatio);
    this.#renderer = parts.renderer;
    this.session = parts.session;

    const { mirror } = parts.session;

    const perspective = new PerspectiveCamera(FIELD_OF_VIEW, 1, NEAR_PLANE, FAR_PLANE);

    function heightAt(x: number, z: number): number {
      return mirror.heightAt(x, z);
    }

    this.camera = new GodCamera(perspective, heightAt, mirror.grid.halfSize);
    this.#world = new WorldRenderer({
      camera: perspective,
      mirror,
      onShake: (amount, x, z) => this.#shake(amount, x, z),
      quality: RENDER_QUALITY[parts.quality],
      renderer: parts.renderer,
    });
    this.#entityPicker = new EntityPicker(perspective, heightAt);
    this.#labels = new LabelProjector(
      perspective,
      { heightAt, surfaceAt: (x, z) => mirror.surfaceAt(x, z) },
      mirror.grid.halfSize
    );

    const groundPicker = new GroundPicker(perspective, heightAt, mirror.grid.halfSize);

    this.powers = new PowerTool((command) => this.session.send(command), {
      hide: () => this.#world.cursor.hide(),
      show: (point, radius, isPressed) => this.#showCursor(point, radius, isPressed),
    });

    this.#pointer = new PointerControls(parts.canvas, this.camera, groundPicker, this.powers, {
      tap: (point, screen) => this.#selectAt(point, screen),
    });
    this.#keyboard = new KeyboardControls(window, this.camera);
    this.#resizeObserver = new ResizeObserver(() => this.#resize());
    this.#resizeObserver.observe(parts.canvas);
    this.#resize();

    for (const type of ACTIVITY_EVENTS) {
      window.addEventListener(type, () => this.#pacer.markActivity(performance.now()), {
        passive: true,
        signal: this.#activity.signal,
      });
    }
  }

  static async start(options: EngineOptions): Promise<GameEngine> {
    const renderer = await createRenderer(options.canvas, RENDER_QUALITY[options.quality]);

    const session = await createSessionOrRelease(
      renderer,
      new WorkerSimulationConnection(),
      options.world,
      options.onProgress
    );

    const engine = new GameEngine({ canvas: options.canvas, quality: options.quality, renderer, session });

    engine.camera.jumpTo(options.camera);
    engine.run();

    return engine;
  }

  get landmarks(): readonly Landmark[] {
    return this.session.mirror.landmarks;
  }

  selectPower(selection: PowerSelection | null): void {
    this.powers.select(selection);
  }

  focusOn(x: number, z: number, distance: number | null = null): void {
    this.camera.flyTo({ targetX: x, targetZ: z, ...(distance === null ? {} : { distance }) });
  }

  followSelection(): void {
    this.camera.setDistance(Math.min(this.camera.state.distance, FOLLOW_DISTANCE));
    this.camera.follow(() => this.#selectedPosition());
  }

  stopFollowing(): void {
    this.camera.follow(null);
  }

  clearSelection(): void {
    this.stopFollowing();
    this.session.send({ selection: null, type: "setSelection" });
  }

  placeLabel(x: number, z: number, lift: number): LabelPlacement | null {
    return this.#labels.place(x, z, lift, this.#viewport);
  }

  subscribeToRenders(listener: () => void): () => void {
    this.#renderListeners.add(listener);

    return () => {
      this.#renderListeners.delete(listener);
    };
  }

  run(): void {
    this.#renderer.setAnimationLoop((time) => this.#frame(time));
  }

  stop(): void {
    this.#renderer.setAnimationLoop(null);
  }

  dispose(): void {
    this.stop();
    this.#activity.abort();
    this.#renderListeners.clear();
    this.#pointer.dispose();
    this.#keyboard.dispose();
    this.#resizeObserver.disconnect();
    this.#world.dispose();
    this.session.close();
    this.#renderer.dispose();
  }

  #frame(time: number): void {
    if (!this.#pacer.isFrameDue(time, document.hasFocus())) {
      return;
    }

    const elapsed = this.#pacer.markRendered(time);
    const hasNewResolution = this.#resolution.record(elapsed, document.hasFocus());

    if (hasNewResolution || window.devicePixelRatio !== this.#devicePixelRatio) {
      this.#resize();
    }

    const realSeconds = clamp(elapsed / MILLISECONDS_PER_SECOND, 0, LONGEST_FRAME_SECONDS);

    this.session.update(realSeconds);
    this.#keyboard.update(realSeconds);
    this.camera.update(realSeconds);

    this.#world.render({
      camera: this.camera.camera,
      effects: this.session.takeEffects(),
      focus: this.camera.target,
      now: time,
      realSeconds,
      viewDistance: this.camera.state.distance,
    });

    for (const listener of this.#renderListeners) {
      listener();
    }

    this.#noticeCameraMotion(time);
    this.#reportViewFocus();
  }

  #reportViewFocus(): void {
    const { target } = this.camera;

    if (Math.hypot(target.x - this.#reportedFocusX, target.z - this.#reportedFocusZ) < VIEW_FOCUS_STEP) {
      return;
    }

    this.#reportedFocusX = target.x;
    this.#reportedFocusZ = target.z;
    this.session.send({ type: "setViewFocus", x: target.x, z: target.z });
  }

  #noticeCameraMotion(time: number): void {
    const placement = this.camera.camera.matrixWorld;

    if (!placement.equals(this.#cameraPlacement)) {
      this.#cameraPlacement.copy(placement);
      this.#pacer.markActivity(time);
    }
  }

  #selectedPosition(): { x: number; z: number } | null {
    const { inspection } = this.session.frame;

    if (inspection === null || inspection.kind === "tribe" || inspection.kind === "cell") {
      return null;
    }

    return { x: inspection.x, z: inspection.z };
  }

  #shake(amount: number, x: number, z: number): void {
    const { target } = this.camera;

    const reach = 400 + this.camera.state.distance;
    const distance = Math.hypot(target.x - x, target.z - z);

    this.camera.shake(amount * Math.max(0, 1 - distance / reach));
  }

  #showCursor(point: Vector3, radius: number, isPressed: boolean): void {
    const color = isPressed ? PRESSED_CURSOR_COLOR : CURSOR_COLOR;

    this.#world.cursor.show(point.x, point.z, radius, color, 0.9);
  }

  #selectAt(point: Vector3 | null, screen: ScreenPoint): void {
    const selection = this.#entityPicker.pick(this.session.frame, screen, this.#viewport, point);

    this.session.send({ selection, type: "setSelection" });
  }

  #resize(): void {
    const width = Math.max(1, this.#canvas.clientWidth);
    const height = Math.max(1, this.#canvas.clientHeight);

    this.#devicePixelRatio = window.devicePixelRatio;
    this.#viewport = { height, width };
    this.#renderer.setDrawingBufferSize(width, height, this.#resolution.pixelRatio(this.#devicePixelRatio));
    this.camera.camera.aspect = width / height;
    this.camera.camera.updateProjectionMatrix();
  }
}
