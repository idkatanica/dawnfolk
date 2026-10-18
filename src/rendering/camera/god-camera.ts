import { type PerspectiveCamera, Vector3 } from "three/webgpu";
import { clamp, wrapAngle } from "../../shared/math.ts";

export interface CameraState {
  readonly distance: number;
  readonly pitch: number;
  readonly targetX: number;
  readonly targetZ: number;
  readonly yaw: number;
}

export interface CameraLimits {
  readonly maximumDistance: number;
  readonly maximumPitch: number;
  readonly minimumDistance: number;
  readonly minimumPitch: number;
}

export const DEFAULT_CAMERA_LIMITS: CameraLimits = {
  maximumDistance: 9000,
  maximumPitch: 1.48,
  minimumDistance: 4,
  minimumPitch: 0.08,
};

export interface FollowTarget {
  readonly x: number;
  readonly z: number;
}

export type HeightProbe = (x: number, z: number) => number;

const SMOOTHING_RATE = 9;
const CLEARANCE = 1.2;

interface MutableCameraState {
  distance: number;
  pitch: number;
  targetX: number;
  targetZ: number;
  yaw: number;
}

export class GodCamera {
  readonly camera: PerspectiveCamera;
  readonly #current: MutableCameraState;
  readonly #goal: MutableCameraState;
  readonly #heightAt: HeightProbe;
  readonly #limits: CameraLimits;
  readonly #offset = new Vector3();
  readonly #position = new Vector3();
  readonly #target = new Vector3();
  readonly #targetCopy = new Vector3();
  readonly #worldHalfSize: number;
  #follow: (() => FollowTarget | null) | null = null;
  #shake = 0;
  #targetHeight: number;

  constructor(camera: PerspectiveCamera, heightAt: HeightProbe, worldHalfSize: number, limits = DEFAULT_CAMERA_LIMITS) {
    this.camera = camera;
    this.#heightAt = heightAt;
    this.#limits = limits;
    this.#worldHalfSize = worldHalfSize;
    this.#goal = { distance: 3200, pitch: 0.82, targetX: 0, targetZ: 0, yaw: 0.6 };
    this.#current = { ...this.#goal };
    this.#targetHeight = heightAt(0, 0);
  }

  get state(): CameraState {
    return { ...this.#current };
  }

  get target(): Vector3 {
    return this.#targetCopy.copy(this.#target);
  }

  jumpTo(state: Partial<CameraState>): void {
    Object.assign(this.#goal, state);
    this.#clampGoal();
    Object.assign(this.#current, this.#goal);
    this.#targetHeight = this.#heightAt(this.#current.targetX, this.#current.targetZ);
    this.#place();
  }

  flyTo(state: Partial<CameraState>): void {
    this.#follow = null;
    Object.assign(this.#goal, state);
    this.#clampGoal();
  }

  setDistance(distance: number): void {
    this.#goal.distance = distance;
    this.#clampGoal();
  }

  orbit(deltaYaw: number, deltaPitch: number): void {
    this.#goal.yaw += deltaYaw;
    this.#goal.pitch += deltaPitch;
    this.#clampGoal();
  }

  zoom(factor: number, focus: FollowTarget | null): void {
    const previous = this.#goal.distance;

    this.#goal.distance *= factor;
    this.#clampGoal();

    if (focus === null || this.#follow !== null) {
      return;
    }

    const pull = 1 - this.#goal.distance / previous;

    this.#goal.targetX += (focus.x - this.#goal.targetX) * pull;
    this.#goal.targetZ += (focus.z - this.#goal.targetZ) * pull;
    this.#clampGoal();
  }

  pan(screenDeltaX: number, screenDeltaY: number, viewportHeight: number): void {
    this.#follow = null;

    const { yaw } = this.#current;
    const metersPerPixel = (2 * this.#goal.distance * Math.tan((this.camera.fov * Math.PI) / 360)) / viewportHeight;
    const slant = Math.max(0.35, Math.sin(this.#current.pitch) * 0.6 + 0.4);

    const scale = metersPerPixel / slant;

    this.#goal.targetX += (-screenDeltaX * Math.cos(yaw) - screenDeltaY * Math.sin(yaw)) * scale;
    this.#goal.targetZ += (screenDeltaX * Math.sin(yaw) - screenDeltaY * Math.cos(yaw)) * scale;
    this.#clampGoal();
  }

  moveBy(forward: number, right: number): void {
    this.#follow = null;

    const { yaw } = this.#current;

    this.#goal.targetX += -Math.sin(yaw) * forward + Math.cos(yaw) * right;
    this.#goal.targetZ += -Math.cos(yaw) * forward - Math.sin(yaw) * right;
    this.#clampGoal();
  }

  follow(target: (() => FollowTarget | null) | null): void {
    this.#follow = target;
  }

  shake(amount: number): void {
    this.#shake = Math.max(this.#shake, amount);
  }

  update(seconds: number): void {
    this.#applyFollow();

    const blend = 1 - Math.exp(-SMOOTHING_RATE * seconds);
    const current = this.#current;
    const goal = this.#goal;

    current.distance += (goal.distance - current.distance) * blend;
    current.pitch += (goal.pitch - current.pitch) * blend;
    current.targetX += (goal.targetX - current.targetX) * blend;
    current.targetZ += (goal.targetZ - current.targetZ) * blend;
    current.yaw += wrapAngle(goal.yaw - current.yaw) * blend;
    this.#targetHeight += (this.#heightAt(current.targetX, current.targetZ) - this.#targetHeight) * blend;
    this.#shake *= Math.exp(-4 * seconds);
    this.#place();
  }

  #applyFollow(): void {
    if (this.#follow === null) {
      return;
    }

    const target = this.#follow();

    if (target === null) {
      this.#follow = null;

      return;
    }

    this.#goal.targetX = target.x;
    this.#goal.targetZ = target.z;
  }

  #clampGoal(): void {
    const limit = this.#worldHalfSize * 1.05;
    const goal = this.#goal;

    goal.distance = clamp(goal.distance, this.#limits.minimumDistance, this.#limits.maximumDistance);
    goal.pitch = clamp(goal.pitch, this.#limits.minimumPitch, this.#limits.maximumPitch);
    goal.targetX = clamp(goal.targetX, -limit, limit);
    goal.targetZ = clamp(goal.targetZ, -limit, limit);
  }

  #place(): void {
    const { distance, pitch, targetX, targetZ, yaw } = this.#current;

    this.#target.set(targetX, this.#targetHeight, targetZ);
    this.#offset
      .set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch))
      .multiplyScalar(distance);

    const position = this.#position.copy(this.#target).add(this.#offset);

    const ground = this.#heightAt(position.x, position.z) + CLEARANCE + distance * 0.02;

    position.y = Math.max(position.y, ground);

    if (this.#shake > 0.01) {
      position.x += (Math.random() - 0.5) * this.#shake;
      position.y += (Math.random() - 0.5) * this.#shake;
      position.z += (Math.random() - 0.5) * this.#shake;
    }

    this.camera.position.copy(position);
    this.camera.lookAt(this.#target);
  }
}
