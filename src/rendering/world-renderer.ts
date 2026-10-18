import {
  Frustum,
  Matrix4,
  type PerspectiveCamera,
  Scene,
  Vector2,
  type Vector3,
  type WebGPURenderer,
} from "three/webgpu";
import type { WorldMirror } from "../game/world-mirror.ts";
import { lerp } from "../shared/math.ts";
import type { SimulationEffect } from "../simulation/effects.ts";
import { AgentMarkers } from "./agents/agent-markers.ts";
import type { AgentViewInput } from "./agents/agent-view-input.ts";
import { AnimalView } from "./agents/animal-view.ts";
import { PeopleView } from "./agents/people-view.ts";
import { Atmosphere } from "./atmosphere/atmosphere.ts";
import { CameraAxes } from "./effects/billboards.ts";
import { EffectView } from "./effects/effect-view.ts";
import { FireGlow } from "./effects/fire-glow.ts";
import { FireView } from "./effects/fire-view.ts";
import { GroundRing } from "./effects/ground-ring.ts";
import { RainSplashes } from "./effects/rain-splashes.ts";
import {
  type Precipitation,
  precipitationOf,
  precipitationStrength,
  WeatherParticles,
} from "./effects/weather-particles.ts";
import { createRenderOutput, type RenderOutput } from "./render-output.ts";
import type { RenderQuality } from "./render-quality.ts";
import { BuildingView } from "./structures/building-view.ts";
import { IslandBase } from "./terrain/island-base.ts";
import { islandPlinthHeight } from "./terrain/island-base-geometry.ts";
import { TerrainTextures } from "./terrain/terrain-textures.ts";
import { TerrainView } from "./terrain/terrain-view.ts";
import { GrassField } from "./vegetation/grass-field.ts";
import { UnderstoryField } from "./vegetation/understory-field.ts";
import { VegetationView } from "./vegetation/vegetation-view.ts";
import { WaterView } from "./water/water-view.ts";
import { WaterfallView } from "./water/waterfall-view.ts";
import { type Wind, windOf } from "./wind.ts";
import { WorldChangeReader } from "./world-changes.ts";

interface RenderView {
  readonly camera: PerspectiveCamera;
  readonly effects: readonly SimulationEffect[];
  readonly focus: Vector3;
  readonly now: number;
  readonly realSeconds: number;
  readonly viewDistance: number;
}

const CLOUD_SEA_DEPTH = 760;
const WATER_DRIFT = 0.08;

const SELECTION_COLOR = 0xff_f2_c8;
const NIGHT_MARKER_BRIGHTNESS = 0.8;

const SELECTION_RADIUS: Readonly<Record<"animal" | "building" | "cell" | "person", number>> = {
  animal: 2.6,
  building: 5.5,
  cell: 5,
  person: 1.1,
};

type ShakeListener = (amount: number, x: number, z: number) => void;

interface WorldRendererOptions {
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
  readonly #effects: EffectView;
  readonly #fire: FireView;
  readonly #fireGlow: FireGlow;
  readonly #frustum = new Frustum();
  readonly #grass: GrassField;
  readonly #islandBase: IslandBase;
  readonly #markers: AgentMarkers;
  readonly #matrix = new Matrix4();
  readonly #mirror: WorldMirror;
  readonly #output: RenderOutput;
  readonly #people = new PeopleView();
  readonly #quality: RenderQuality;
  readonly #renderer: WebGPURenderer;
  readonly #selectionRing: GroundRing;
  readonly #splashes: RainSplashes;
  readonly #terrain: TerrainView;
  readonly #textures: TerrainTextures;
  readonly #understory: UnderstoryField;
  readonly #vegetation: VegetationView;
  readonly #viewport = new Vector2();
  readonly #water: WaterView;
  readonly #waterfalls = new WaterfallView();
  readonly #weather: WeatherParticles;

  constructor({ camera, mirror, onShake, quality, renderer }: WorldRendererOptions) {
    this.#mirror = mirror;
    this.#quality = quality;
    this.#renderer = renderer;
    this.#changes = new WorldChangeReader(mirror);
    this.#textures = new TerrainTextures(mirror);
    this.#fireGlow = new FireGlow(mirror.grid);
    this.#terrain = new TerrainView(mirror, this.#textures, this.#fireGlow, renderer);
    this.#islandBase = new IslandBase(mirror, this.#textures);
    this.#water = new WaterView(mirror, this.#textures);
    this.#waterfalls.rebuild(mirror.water.waterfalls, this.#textures.outline);
    this.#vegetation = new VegetationView(mirror, this.#textures, this.#fireGlow);
    this.#understory = new UnderstoryField(mirror);

    this.#grass = new GrassField({
      clumpsPerSide: quality.grassClumpsPerSide,
      grid: mirror.grid,
      textures: this.#textures,
      understory: this.#understory.texture,
      weather: this.#vegetation.weather,
    });

    this.cursor = new GroundRing(this.#textures, mirror.grid);
    this.#selectionRing = new GroundRing(this.#textures, mirror.grid);
    this.#fire = new FireView({ axes: this.#axes, chunks: this.#vegetation.chunks });
    this.#markers = new AgentMarkers(this.#axes, mirror);
    this.#weather = new WeatherParticles(this.#axes, this.#textures, mirror.grid);
    this.#splashes = new RainSplashes(this.#axes, this.#textures, mirror.grid);

    this.#effects = new EffectView({
      axes: this.#axes,
      createRing: () => new GroundRing(this.#textures, mirror.grid),
      heightAt: (x, z) => mirror.heightAt(x, z),
      shake: onShake,
    });

    this.#atmosphere = new Atmosphere(this.scene, {
      cloudSeaAltitude: islandPlinthHeight(mirror, this.#textures.outline) - CLOUD_SEA_DEPTH,
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
      this.#markers.group,
      this.#buildings.group,
      this.cursor.mesh,
      this.#selectionRing.mesh,
      this.#fire.group,
      this.#effects.group,
      this.#splashes.mesh,
      this.#weather.group
    );

    this.#output = createRenderOutput(renderer, this.scene, camera, quality);
  }

  render(view: RenderView): void {
    const { frame } = this.#mirror;

    const changes = this.#changes.take();

    this.#textures.update(this.#renderer, frame.calendar.season, changes);
    this.#fireGlow.update(frame);

    if (changes.heightRegion !== null) {
      this.#terrain.heightsChanged(changes.heightRegion);
      this.#vegetation.heightsChanged(changes.heightRegion);
      this.#understory.heightsChanged(changes.heightRegion);
    }

    if (changes.vegetationIndices.length > 0) {
      this.#vegetation.plantsChanged(changes.vegetationIndices);
      this.#understory.plantsChanged(changes.vegetationIndices);
    }

    if (changes.hasWaterChanged) {
      this.#water.waterChanged();
      this.#waterfalls.rebuild(this.#mirror.water.waterfalls, this.#textures.outline);
    }

    const wind = windOf(frame.weather);
    const form = this.#precipitationAt(view.focus);
    const strength = precipitationStrength(frame.weather.precipitation);

    const rainfall = form === "rain" ? strength : 0;

    this.#atmosphere.update(
      {
        cloudCover: frame.weather.cloudCover,
        flash: this.#effects.flash,
        fog: frame.weather.fog,
        hours: frame.calendar.hours,
        precipitation: frame.weather.precipitation,
        season: frame.calendar.season,
        snowfall: form === "snow" ? frame.weather.precipitation : 0,
        storm: frame.weather.storm,
        windX: wind.directionX * wind.metersPerSecond,
        windZ: wind.directionZ * wind.metersPerSecond,
      },
      view.focus,
      view.viewDistance,
      view.realSeconds
    );

    this.#paintWater(wind, strength, rainfall, view.realSeconds);
    this.#vegetation.weather.blow(wind.directionX, wind.directionZ, wind.metersPerSecond, view.realSeconds);
    view.camera.updateMatrixWorld();
    this.#terrain.update(view.camera, this.#quality.terrainDetail);
    this.#islandBase.followPatchLevels(this.#terrain.patchLevels);
    this.#water.update(view.camera, this.#quality.terrainDetail, this.#terrain.patchLevels);
    this.#vegetation.update(view.camera, this.#atmosphere.sun, this.#quality.vegetationDetail, frame.calendar.season);
    this.#grass.update(view.camera, view.viewDistance);
    this.#updateAgents(view);
    this.#markSelection();
    this.#updateEffects(view, wind, form, rainfall);
    this.#output.render();
  }

  dispose(): void {
    this.#fire.dispose();
    this.#effects.dispose();
    this.#weather.dispose();
    this.#splashes.dispose();
    this.cursor.dispose();
    this.#selectionRing.dispose();
    this.#people.dispose();
    this.#animals.dispose();
    this.#markers.dispose();
    this.#buildings.dispose();
    this.#vegetation.dispose();
    this.#grass.dispose();
    this.#understory.dispose();
    this.#water.dispose();
    this.#waterfalls.dispose();
    this.#terrain.dispose();
    this.#islandBase.dispose();
    this.#textures.dispose();
    this.#fireGlow.dispose();
    this.#atmosphere.dispose();
    this.#output.dispose();
  }

  #paintWater(wind: Wind, precipitation: number, rainfall: number, realSeconds: number): void {
    const { look } = this.#water;
    const { palette } = this.#atmosphere;

    look.horizonColor.value.setHex(palette.horizon);
    look.zenithColor.value.setHex(palette.zenith);
    look.daylight.value = this.#atmosphere.daylight;
    look.precipitation.value = precipitation;
    look.rainfall.value = rainfall;
    look.windTravel.value.x += wind.directionX * wind.metersPerSecond * WATER_DRIFT * realSeconds;
    look.windTravel.value.y += wind.directionZ * wind.metersPerSecond * WATER_DRIFT * realSeconds;
  }

  #updateAgents(view: RenderView): void {
    const mirror = this.#mirror;
    const { frame } = mirror;
    const { camera } = view;

    this.#frustum.setFromProjectionMatrix(
      this.#matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    );

    const input: AgentViewInput = {
      camera,
      detail: this.#quality.agentDetail,
      frustum: this.#frustum,
      gameSeconds: frame.isPaused ? 0 : view.realSeconds * frame.speed,
      markers: this.#markers,
      mirror,
      realSeconds: view.realSeconds,
      secondsSinceTick: mirror.gameSecondsSinceTick(view.now),
    };

    this.#markers.brightness.value = lerp(NIGHT_MARKER_BRIGHTNESS, 1, this.#atmosphere.daylight);
    this.#markers.begin(camera, this.#frustum, this.#renderer.getSize(this.#viewport).y);
    this.#people.update(input);
    this.#animals.update(input);
    this.#markers.commit();
    this.#buildings.update(input);
  }

  #updateEffects(view: RenderView, wind: Wind, form: Precipitation, rainfall: number): void {
    const { weather } = this.#mirror.frame;

    const darkness = 1 - this.#atmosphere.daylight;
    const brightness = 0.25 + this.#atmosphere.daylight * 0.75;

    this.#axes.update(view.camera);
    this.#fire.smoke.brightness.value = 0.3 + this.#atmosphere.daylight * 0.7;
    this.#fire.smoke.wind.value
      .set(wind.directionX, wind.directionZ)
      .multiplyScalar(Math.min(1.5, wind.metersPerSecond / 5));
    this.#fire.update(this.#mirror, view.camera, darkness);
    this.#effects.add(view.effects);
    this.#effects.update(view.realSeconds);
    this.#splashes.update(rainfall, brightness, {
      camera: view.camera,
      focusX: view.focus.x,
      focusZ: view.focus.z,
      realSeconds: view.realSeconds,
      viewDistance: view.viewDistance,
    });
    this.#weather.update(
      {
        brightness,
        form,
        precipitation: weather.precipitation,
        windX: wind.directionX * wind.metersPerSecond,
        windZ: wind.directionZ * wind.metersPerSecond,
      },
      view
    );
  }

  #precipitationAt(focus: Vector3): Precipitation {
    const { frame, grid, terrain } = this.#mirror;

    const cell = grid.cellAt(focus.x, focus.z);

    const ground = cell < 0 ? 0 : terrain.baseTemperature[cell];

    return precipitationOf(frame.weather.kind, ground + frame.weather.airTemperatureOffset);
  }

  #markSelection(): void {
    const { inspection } = this.#mirror.frame;

    if (inspection === null || inspection.kind === "tribe") {
      this.#selectionRing.hide();

      return;
    }

    this.#selectionRing.show(inspection.x, inspection.z, SELECTION_RADIUS[inspection.kind], SELECTION_COLOR, 0.9);
  }
}
