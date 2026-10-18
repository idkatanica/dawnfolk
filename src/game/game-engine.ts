import { Matrix4, PerspectiveCamera, type Vector3, type WebGPURenderer } from "three/webgpu";
import type { GenerationProgress } from "../generation/world-generator.ts";
import { type CameraState, GodCamera } from "../rendering/camera/god-camera.ts";
import { createRenderer, type GraphicsBackend } from "../rendering/create-renderer.ts";
import { type QualityLevel, RENDER_QUALITY } from "../rendering/render-quality.ts";
import { WorldRenderer } from "../rendering/world-renderer.ts";
import { clamp } from "../shared/math.ts";
import type { WorldRequest } from "../workers/simulation-worker-api.ts";
import type { EngineHandle } from "./engine-handle.ts";
import { FramePacer } from "./frame-pacer.ts";
import { GameSession } from "./game-session.ts";
import { EntityPicker } from "./input/entity-picker.ts";
import { GroundPicker, type ScreenPoint, type ViewportSize } from "./input/ground-picker.ts";
import { KeyboardControls } from "./input/keyboard-controls.ts";
import { PointerControls } from "./input/pointer-controls.ts";
import { type LabelPlacement, LabelProjector } from "./label-projector.ts";
import { findLandmarks, type Landmark } from "./landmarks.ts";
import { type SimulationConnection, WorkerSimulationConnection } from "./simulation-connection.ts";
import { type PowerSelection, PowerTool } from "./tools/power-tool.ts";

interface EngineOptions {
  readonly camera?: Partial<CameraState>;
  readonly canvas: HTMLCanvasElement;
  readonly connection?: SimulationConnection;
  readonly onProgress?: (progress: GenerationProgress) => void;
  readonly quality: QualityLevel;
  readonly request: WorldRequest;
}

interface EngineParts {
  readonly backend: GraphicsBackend;
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

async function createSessionOrRelease(
  renderer: WebGPURenderer,
  connection: SimulationConnection,
  request: WorldRequest,
  onProgress: (progress: GenerationProgress) => void
): Promise<GameSession> {
  try {
    return await GameSession.create(connection, request, { onProgress });
  } catch (error) {
    renderer.dispose();
    connection.dispose();

    throw error;
  }
}

export class GameEngine implements EngineHandle {
  readonly backend: GraphicsBackend;
  readonly camera: GodCamera;
  readonly landmarks: readonly Landmark[];
  readonly powers: PowerTool;
  readonly quality: QualityLevel;
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
  readonly #world: WorldRenderer;
  #lastFrameTime = Number.NaN;
  #reportedFocusX = Number.NaN;
  #reportedFocusZ = Number.NaN;
  #viewport: ViewportSize = { height: 1, width: 1 };

  constructor(parts: EngineParts) {
    this.#canvas = parts.canvas;
    this.#renderer = parts.renderer;
    this.backend = parts.backend;
    this.session = parts.session;
    this.quality = parts.quality;

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
    this.landmarks = findLandmarks({
      grid: mirror.grid,
      heights: mirror.terrain.height,
      lakes: mirror.water.lakes,
      monuments: mirror.monuments,
      seed: mirror.seed,
    });

    const groundPicker = new GroundPicker(perspective, heightAt, mirror.grid.halfSize);

    this.powers = new PowerTool(
      (command) => this.session.send(command),
      {
        hide: () => this.#world.cursor.hide(),
        show: (point, radius, isPressed) => this.#showCursor(point, radius, isPressed),
      },
      (point, screen) => this.#selectAt(point, screen)
    );

    this.#pointer = new PointerControls(parts.canvas, this.camera, groundPicker, this.powers);
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
    const { camera = {}, connection = new WorkerSimulationConnection(), onProgress = () => undefined } = options;

    const created = await createRenderer(options.canvas, RENDER_QUALITY[options.quality]);

    const session = await createSessionOrRelease(created.renderer, connection, options.request, onProgress);

    const engine = new GameEngine({ ...created, canvas: options.canvas, quality: options.quality, session });

    engine.camera.jumpTo(camera);
    engine.run();

    return engine;
  }

  selectPower(selection: PowerSelection | null): void {
    this.powers.select(selection);
  }

  focusOn(x: number, z: number, distance: number | null = null): void {
    if (distance === null) {
      this.camera.flyTo({ targetX: x, targetZ: z });

      return;
    }

    this.camera.flyTo({ distance, targetX: x, targetZ: z });
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

    this.#pacer.markRendered(time);

    const realSeconds = this.#elapsedSeconds(time);

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

  #elapsedSeconds(time: number): number {
    const previous = this.#lastFrameTime;

    this.#lastFrameTime = time;

    if (Number.isNaN(previous)) {
      return 0;
    }

    return clamp((time - previous) / MILLISECONDS_PER_SECOND, 0, LONGEST_FRAME_SECONDS);
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

    this.#viewport = { height, width };
    this.#renderer.setSize(width, height, false);
    this.camera.camera.aspect = width / height;
    this.camera.camera.updateProjectionMatrix();
  }
}
