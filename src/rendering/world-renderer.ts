import { Frustum, Matrix4, type PerspectiveCamera, Scene, type Vector3, type WebGPURenderer } from "three/webgpu";
import type { WorldMirror } from "../game/world-mirror.ts";
import { clamp } from "../shared/math.ts";
import type { SimulationEffect } from "../simulation/effects.ts";
import { AgentDots } from "./agents/agent-dots.ts";
import type { AgentViewInput } from "./agents/agent-view-input.ts";
import { AnimalView } from "./agents/animal-view.ts";
import { PeopleView } from "./agents/people-view.ts";
import { Atmosphere } from "./atmosphere/atmosphere.ts";
import { CameraAxes } from "./effects/billboards.ts";
import { EffectView } from "./effects/effect-view.ts";
import { FireGlow } from "./effects/fire-glow.ts";
import { FireView } from "./effects/fire-view.ts";
import { GroundRing } from "./effects/ground-ring.ts";
import { precipitationOf, WeatherParticles } from "./effects/weather-particles.ts";
import { createRenderOutput, type RenderOutput } from "./render-output.ts";
import type { RenderQuality } from "./render-quality.ts";
import { BuildingView } from "./structures/building-view.ts";
import { IslandBase } from "./terrain/island-base.ts";
import { islandPlinthHeight } from "./terrain/island-base-geometry.ts";
import { TerrainTextures } from "./terrain/terrain-textures.ts";
import { TerrainView } from "./terrain/terrain-view.ts";
import { GrassField } from "./vegetation/grass-field.ts";
import { VegetationView } from "./vegetation/vegetation-view.ts";
import { WaterView } from "./water/water-view.ts";
import { WaterfallView } from "./water/waterfall-view.ts";
import { type Wind, windOf } from "./wind.ts";
import { WorldChangeReader } from "./world-changes.ts";

export interface RenderView {
  readonly camera: PerspectiveCamera;
  readonly effects: readonly SimulationEffect[];
  readonly focus: Vector3;
  readonly now: number;
  readonly realSeconds: number;
  readonly viewDistance: number;
}

const CLOUD_SEA_DEPTH = 760;

const SELECTION_COLOR = 0xff_f2_c8;

const SELECTION_RADIUS: Readonly<Record<"animal" | "building" | "cell" | "person", number>> = {
  animal: 2.6,
  building: 5.5,
  cell: 5,
  person: 1.1,
};

export type ShakeListener = (amount: number, x: number, z: number) => void;

export interface WorldRendererOptions {
  readonly camera: PerspectiveCamera;
  readonly mirror: WorldMirror;
  readonly onShake: ShakeListener;
  readonly quality: RenderQuality;
  readonly renderer: WebGPURenderer;
}

export class WorldRenderer {
  readonly cursor: GroundRing;
  readonly scene = new Scene();
  readonly #animals = new AnimalView();
  readonly #atmosphere: Atmosphere;
  readonly #axes = new CameraAxes();
  readonly #buildings = new BuildingView();
  readonly #changes: WorldChangeReader;
  readonly #dots: AgentDots;
  readonly #effects: EffectView;
  readonly #fire: FireView;
  readonly #fireGlow: FireGlow;
  readonly #frustum = new Frustum();
  readonly #grass: GrassField;
  readonly #islandBase: IslandBase;
  readonly #matrix = new Matrix4();
  readonly #mirror: WorldMirror;
  readonly #output: RenderOutput;
  readonly #people = new PeopleView();
  readonly #quality: RenderQuality;
  readonly #selectionRing: GroundRing;
  readonly #terrain: TerrainView;
  readonly #textures: TerrainTextures;
  readonly #vegetation: VegetationView;
  readonly #water: WaterView;
  readonly #waterfalls = new WaterfallView();
  readonly #weather: WeatherParticles;

  constructor({ camera, mirror, onShake, quality, renderer }: WorldRendererOptions) {
    this.#mirror = mirror;
    this.#quality = quality;
    this.#changes = new WorldChangeReader(mirror);
    this.#textures = new TerrainTextures(mirror);
    this.#fireGlow = new FireGlow(mirror.grid);
    this.#terrain = new TerrainView(mirror, this.#textures, this.#fireGlow);
    this.#islandBase = new IslandBase(mirror, this.#textures);
    this.#water = new WaterView(mirror, this.#textures);
    this.#waterfalls.rebuild(mirror.water.waterfalls);
    this.#vegetation = new VegetationView(mirror, this.#textures, this.#fireGlow);

    this.#grass = new GrassField({
      clumpsPerSide: quality.grassClumpsPerSide,
      grid: mirror.grid,
      textures: this.#textures,
      weather: this.#vegetation.weather,
    });

    this.cursor = new GroundRing(this.#textures, mirror.grid);
    this.#selectionRing = new GroundRing(this.#textures, mirror.grid);
    this.#fire = new FireView({ axes: this.#axes, chunks: this.#vegetation.chunks });
    this.#dots = new AgentDots(this.#axes);
    this.#weather = new WeatherParticles(this.#axes);

    this.#effects = new EffectView({
      axes: this.#axes,
      createRing: () => new GroundRing(this.#textures, mirror.grid),
      heightAt: (x, z) => mirror.heightAt(x, z),
      shake: onShake,
    });

    this.#atmosphere = new Atmosphere(this.scene, {
      cloudSeaAltitude: islandPlinthHeight(mirror) - CLOUD_SEA_DEPTH,
      shadowMapSize: quality.shadowMapSize,
    });

    this.scene.add(
      this.#terrain.group,
      this.#islandBase.mesh,
      this.#water.group,
      this.#waterfalls.mesh,
      this.#vegetation.group,
      this.#grass.mesh,
      this.#people.group,
      this.#animals.group,
      this.#dots.mesh,
      this.#buildings.group,
      this.cursor.mesh,
      this.#selectionRing.mesh,
      this.#fire.group,
      this.#effects.group,
      this.#weather.mesh
    );

    this.#output = createRenderOutput(renderer, this.scene, camera, quality);
  }

  render(view: RenderView): void {
    const { frame } = this.#mirror;
    const changes = this.#changes.take();

    this.#textures.update(frame.calendar.season, changes);
    this.#fireGlow.update(frame);

    if (changes.heightRegion !== null) {
      this.#terrain.heightsChanged(changes.heightRegion);
      this.#vegetation.heightsChanged(changes.heightRegion);
    }

    if (changes.vegetationIndices.length > 0) {
      this.#vegetation.plantsChanged(changes.vegetationIndices);
    }

    if (changes.hasWaterChanged) {
      this.#water.waterChanged();
      this.#waterfalls.rebuild(this.#mirror.water.waterfalls);
    }

    const wind = windOf(frame.weather);

    this.#atmosphere.update(
      {
        cloudCover: frame.weather.cloudCover,
        flash: this.#effects.flash,
        fog: frame.weather.fog,
        hours: frame.calendar.hours,
        precipitation: frame.weather.precipitation,
        season: frame.calendar.season,
        storm: frame.weather.storm,
        windX: wind.directionX * wind.metersPerSecond,
        windZ: wind.directionZ * wind.metersPerSecond,
      },
      view.focus,
      view.viewDistance,
      view.realSeconds
    );

    this.#paintWater(wind);
    this.#blowWind(wind);
    view.camera.updateMatrixWorld();
    this.#terrain.update(view.camera, this.#quality.terrainDetail);
    this.#water.update(view.camera, this.#quality.terrainDetail, this.#terrain.patchLevels);
    this.#vegetation.update(view.camera, this.#quality.vegetationDetail, frame.calendar.season);
    this.#grass.update(view.camera, view.viewDistance);
    this.#updateAgents(view);
    this.#markSelection();
    this.#updateEffects(view, wind);
    this.#output.render();
  }

  #paintWater(wind: Wind): void {
    const { look } = this.#water;
    const { palette } = this.#atmosphere;

    look.horizonColor.value.setHex(palette.horizon);
    look.zenithColor.value.setHex(palette.zenith);
    look.daylight.value = this.#atmosphere.daylight;
    look.windDrift.value.set(wind.directionX, wind.directionZ).multiplyScalar(wind.metersPerSecond * 0.08);
  }

  #updateAgents(view: RenderView): void {
    const mirror = this.#mirror;
    const { camera } = view;

    const { frame } = mirror;

    this.#frustum.setFromProjectionMatrix(
      this.#matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    );

    const input: AgentViewInput = {
      camera,
      detail: this.#quality.agentDetail,
      dots: this.#dots,
      frustum: this.#frustum,
      gameSeconds: frame.isPaused ? 0 : view.realSeconds * frame.speed,
      mirror,
      realSeconds: view.realSeconds,
      secondsSinceTick: mirror.gameSecondsSinceTick(view.now),
    };

    this.#dots.begin();
    this.#people.update(input);
    this.#animals.update(input);
    this.#dots.commit();
    this.#buildings.update(input);
  }

  #updateEffects(view: RenderView, wind: Wind): void {
    const { weather } = this.#mirror.frame;
    const darkness = 1 - this.#atmosphere.daylight;

    this.#axes.update(view.camera);
    this.#fire.smoke.brightness.value = 0.3 + this.#atmosphere.daylight * 0.7;
    this.#fire.smoke.wind.value
      .set(wind.directionX, wind.directionZ)
      .multiplyScalar(Math.min(1.5, wind.metersPerSecond / 5));
    this.#fire.update(this.#mirror, view.camera, darkness);
    this.#effects.add(view.effects);
    this.#effects.update(view.realSeconds);
    this.#weather.update(
      weather.precipitation,
      precipitationOf(weather.kind),
      wind.directionX * wind.metersPerSecond,
      wind.directionZ * wind.metersPerSecond
    );
  }

  #markSelection(): void {
    const { inspection } = this.#mirror.frame;

    if (inspection === null || inspection.kind === "tribe") {
      this.#selectionRing.hide();

      return;
    }

    this.#selectionRing.show(inspection.x, inspection.z, SELECTION_RADIUS[inspection.kind], SELECTION_COLOR, 0.9);
  }

  #blowWind(wind: Wind): void {
    const { weather } = this.#vegetation;

    weather.gust.value = clamp(wind.metersPerSecond / 7, 0.12, 2);
    weather.wind.value.set(wind.directionX, wind.directionZ);
  }

  dispose(): void {
    this.#fire.dispose();
    this.#effects.dispose();
    this.#weather.dispose();
    this.cursor.dispose();
    this.#selectionRing.dispose();
    this.#people.dispose();
    this.#animals.dispose();
    this.#dots.dispose();
    this.#buildings.dispose();
    this.#vegetation.dispose();
    this.#grass.dispose();
    this.#water.dispose();
    this.#waterfalls.dispose();
    this.#terrain.dispose();
    this.#islandBase.dispose();
    this.#textures.dispose();
    this.#fireGlow.dispose();
    this.#atmosphere.dispose();
    this.#output.dispose();
  }
}
