import { attribute, float, int, varying } from "three/tsl";
import {
  BufferGeometry,
  Float32BufferAttribute,
  Matrix4,
  Mesh,
  MeshStandardNodeMaterial,
  Uint32BufferAttribute,
} from "three/webgpu";
import { Biome, isBiomeIndex } from "../../content/biomes.ts";
import { PlantSpecies, ROCK_RULES } from "../../content/plants.ts";
import type { WorldMirror } from "../../game/world-mirror.ts";
import { MaterialSlot } from "../../models/materials.ts";
import { MeshBuilder } from "../../models/mesh/mesh-builder.ts";
import type { MeshData } from "../../models/mesh/mesh-data.ts";
import { isRockModel, meshRock, ROCK_VARIANT_COUNTS } from "../../models/plants/rocks.ts";
import { type CaveLook, meshCaveMouth } from "../../models/structures/cave-mouth.ts";
import { FULL_TURN } from "../../shared/math.ts";
import { createRandom, type RandomSource } from "../../shared/random.ts";
import type { Spring } from "../../world/water.ts";
import { slotColorTable } from "../node-helpers.ts";

const CAVE_SINK = 0.3;
const RIM_STONES = [5, 8] as const;
const OUTLET_GAP = 0.9;
const STONE_SINK = 0.25;
const RISE_REACHES = [6, 10, 14] as const;
const LAND_REACHES = [20, 40] as const;
const LAND_SAMPLES = 8;

const COLD_BIOMES: ReadonlySet<number> = new Set([Biome.Alpine, Biome.Glacier, Biome.Tundra]);
const DRY_BIOMES: ReadonlySet<number> = new Set([Biome.Desert, Biome.Mesa]);
const WOODED_BIOMES: ReadonlySet<number> = new Set([Biome.Forest, Biome.Swamp, Biome.Taiga]);
const SHORE_BIOMES: ReadonlySet<number> = new Set([Biome.Beach, Biome.Water]);

class ModelCache {
  #kept = new Map<string, MeshData>();
  #used = new Map<string, MeshData>();

  model(key: string, build: () => MeshData): MeshData {
    const known = this.#used.get(key);
    const kept = known === undefined ? this.#kept.get(key) : known;
    const model = kept === undefined ? build() : kept;

    this.#used.set(key, model);

    return model;
  }

  keepUsed(): void {
    this.#kept = this.#used;
    this.#used = new Map();
  }
}

interface RockyRim {
  readonly models: ModelCache;
  readonly random: RandomSource;
  readonly stones: ReturnType<typeof rimStonesFor>;
}

function landBiomeNear(mirror: WorldMirror, spring: Spring): number {
  for (const reach of LAND_REACHES) {
    for (let sample = 0; sample < LAND_SAMPLES; sample += 1) {
      const angle = (sample / LAND_SAMPLES) * FULL_TURN;
      const cell = mirror.grid.cellAt(
        spring.x + Math.cos(angle) * (spring.radius + reach),
        spring.z + Math.sin(angle) * (spring.radius + reach)
      );

      if (cell >= 0 && !SHORE_BIOMES.has(mirror.terrain.biome[cell])) {
        return mirror.terrain.biome[cell];
      }
    }
  }

  return Biome.Meadow;
}

function rimStonesFor(biome: number) {
  const rules = isBiomeIndex(biome) ? ROCK_RULES[biome] : [];

  const stones = rules
    .map((rule) => rule.species)
    .filter(isRockModel)
    .filter((species) => species !== PlantSpecies.Crag);

  return stones.length > 0 ? stones : [PlantSpecies.Boulder];
}

function riseBehind(spring: Spring, mirror: WorldMirror): number {
  let highest = 0;

  for (const reach of RISE_REACHES) {
    const ground = mirror.heightAt(spring.x - spring.directionX * reach, spring.z - spring.directionZ * reach);

    highest = Math.max(highest, ground - spring.level);
  }

  return highest;
}

function caveLookFor(biome: number): CaveLook {
  if (COLD_BIOMES.has(biome)) {
    return { base: MaterialSlot.Basalt, frost: 0.3, moss: 0.05 };
  }

  if (DRY_BIOMES.has(biome)) {
    return { base: MaterialSlot.Sandstone, frost: 0, moss: 0 };
  }

  return { base: MaterialSlot.Stone, frost: 0, moss: WOODED_BIOMES.has(biome) ? 0.5 : 0.25 };
}

function createSpringMaterial(): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial();
  const slot = int(attribute("slot", "float").add(0.5));
  const shade = attribute("shade", "float");

  material.colorNode = varying(slotColorTable().element(slot).mul(shade), "springColor");
  material.roughnessNode = float(0.92);
  material.metalnessNode = float(0);

  return material;
}

function headingOf(spring: Spring): Matrix4 {
  return new Matrix4().makeRotationY(Math.atan2(spring.directionX, spring.directionZ));
}

function addCave(builder: MeshBuilder, spring: Spring, mirror: WorldMirror, models: ModelCache): void {
  const biome = landBiomeNear(mirror, spring);
  const rise = Math.round(riseBehind(spring, mirror) * 2) / 2;

  const cave = models.model(`cave ${spring.seed} ${spring.radius} ${rise} ${biome}`, () =>
    meshCaveMouth({ look: caveLookFor(biome), rise, seed: spring.seed, width: spring.radius * 2 })
  );

  const placement = new Matrix4()
    .makeTranslation(spring.x, spring.level - CAVE_SINK, spring.z)
    .multiply(headingOf(spring));

  builder.addMesh(cave, { transform: placement });
}

function addRimStone(builder: MeshBuilder, spring: Spring, mirror: WorldMirror, rim: RockyRim): void {
  const { models, random } = rim;

  const outlet = Math.atan2(spring.directionZ, spring.directionX);
  const angle = outlet + OUTLET_GAP + random.next() * (FULL_TURN - OUTLET_GAP * 2);
  const reach = spring.radius + random.between(0.4, 1.8);

  const x = spring.x + Math.cos(angle) * reach;
  const z = spring.z + Math.sin(angle) * reach;

  const species = random.pick(rim.stones);
  const variant = random.integer(0, ROCK_VARIANT_COUNTS[species]);
  const seed = random.integer(1, 1_000_000);
  const size = random.between(1.1, 2.1);

  const stone = models.model(`rock ${species} ${seed} ${variant}`, () => meshRock(species, seed, variant, "medium"));

  const placement = new Matrix4()
    .makeTranslation(x, mirror.heightAt(x, z) - STONE_SINK, z)
    .multiply(new Matrix4().makeRotationY(random.next() * FULL_TURN))
    .multiply(new Matrix4().makeScale(size, size, size));

  builder.addMesh(stone, { transform: placement });
}

function addRockyRim(builder: MeshBuilder, spring: Spring, mirror: WorldMirror, models: ModelCache): void {
  const random = createRandom(Math.floor(spring.seed * 1_000_000) + 7);

  const rim: RockyRim = { models, random, stones: rimStonesFor(landBiomeNear(mirror, spring)) };
  const count = random.integer(RIM_STONES[0], RIM_STONES[1] + 1);

  for (let stone = 0; stone < count; stone += 1) {
    addRimStone(builder, spring, mirror, rim);
  }
}

export class SpringView {
  readonly mesh: Mesh;
  readonly #models = new ModelCache();

  constructor() {
    this.mesh = new Mesh(new BufferGeometry(), createSpringMaterial());
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
  }

  rebuild(mirror: WorldMirror): void {
    const builder = new MeshBuilder();

    for (const spring of mirror.water.springs) {
      if (spring.kind === "cave") {
        addCave(builder, spring, mirror, this.#models);
      }

      if (spring.kind === "rocky") {
        addRockyRim(builder, spring, mirror, this.#models);
      }
    }

    this.#models.keepUsed();

    const data = builder.build();
    const geometry = new BufferGeometry();

    geometry.setAttribute("position", new Float32BufferAttribute(data.positions, 3));
    geometry.setAttribute("normal", new Float32BufferAttribute(data.normals, 3));
    geometry.setAttribute("slot", new Float32BufferAttribute(data.channels.slot, 1));
    geometry.setAttribute("shade", new Float32BufferAttribute(data.channels.shade, 1));
    geometry.setIndex(new Uint32BufferAttribute(data.indices, 1));

    this.mesh.geometry.dispose();
    this.mesh.geometry = geometry;
    this.mesh.visible = data.indices.length > 0;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
  }
}
