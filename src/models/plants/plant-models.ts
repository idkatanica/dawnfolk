import { Vector3 } from "three";
import { PLANT_SPECIES, PlantSpecies, type PlantSpeciesIndex } from "../../content/plants.ts";
import { createRandom } from "../../shared/random.ts";
import { MaterialSlot } from "../materials.ts";
import { MeshBuilder } from "../mesh/mesh-builder.ts";
import { type MeshData, mergeMeshes } from "../mesh/mesh-data.ts";
import { sphere } from "../mesh/shapes.ts";
import { outermostHit } from "../mesh/surface-probe.ts";
import { transformOf } from "../mesh/transforms.ts";
import { meshBoulder, meshCactus } from "./ground-plants.ts";
import { FOLIAGE_FLUTTER, meshTree, type PlantDetailLevel, plantSway, type TreeLook } from "./tree-mesher.ts";
import { CANONICAL_HEIGHTS, TREE_GENERATORS } from "./tree-species.ts";
import type { FoliageBlob, TreeStructure } from "./tree-structure.ts";

export const PLANT_VARIANT_COUNT = 4;

export const PLANT_DETAIL_LEVELS: readonly PlantDetailLevel[] = ["high", "medium", "low"];

export const BERRY_PART = 1;

const BERRY_RADIUS = 0.07;

const BROADLEAF: TreeLook = { bark: MaterialSlot.Bark, foliage: MaterialSlot.Leaf, hasBarkMarks: false };
const CONIFER: TreeLook = { bark: MaterialSlot.Bark, foliage: MaterialSlot.Needle, hasBarkMarks: false };
const BIRCH: TreeLook = { bark: MaterialSlot.BirchBark, foliage: MaterialSlot.Leaf, hasBarkMarks: true };

const TREE_LOOKS: Readonly<Partial<Record<PlantSpeciesIndex, TreeLook>>> = {
  [PlantSpecies.Birch]: BIRCH,
  [PlantSpecies.Bush]: BROADLEAF,
  [PlantSpecies.Maple]: BROADLEAF,
  [PlantSpecies.Oak]: BROADLEAF,
  [PlantSpecies.Pine]: CONIFER,
  [PlantSpecies.Spruce]: CONIFER,
  [PlantSpecies.Willow]: BROADLEAF,
};

export function variantSeed(species: PlantSpeciesIndex, variant: number): number {
  return species * 1000 + variant * 77 + 13;
}

function berries(
  tree: MeshData,
  structure: TreeStructure,
  look: TreeLook,
  seed: number,
  level: PlantDetailLevel
): MeshData {
  const random = createRandom(seed);
  const builder = new MeshBuilder({ flutter: FOLIAGE_FLUTTER, part: BERRY_PART, slot: MaterialSlot.Berry });
  const blobs = structure.foliage.filter((foliage): foliage is FoliageBlob => foliage.kind === "blob");
  const count = level === "high" ? 26 : 12;

  const isFoliage = (triangle: number): boolean => tree.channels.slot[tree.indices[triangle * 3]] === look.foliage;

  for (let berry = 0; berry < count; berry += 1) {
    const host = random.pick(blobs);
    const angle = random.next() * Math.PI * 2;
    const height = random.between(-0.2, 0.9);

    const horizontal = Math.sqrt(1 - height * height);

    const outward = new Vector3(Math.cos(angle) * horizontal, height * host.squash, Math.sin(angle) * horizontal);

    const hit = outermostHit(tree, new Vector3(...host.center), outward, isFoliage);

    if (hit === null) {
      continue;
    }

    builder.add(sphere(BERRY_RADIUS, 5, 3), {
      style: { sway: (point) => plantSway(point.position.y, structure.height) },
      transform: transformOf({ position: hit.point.toArray() }),
    });
  }

  return builder.build();
}

function meshVariant(species: PlantSpeciesIndex, variant: number, level: PlantDetailLevel): MeshData {
  const seed = variantSeed(species, variant);

  if (species === PlantSpecies.Cactus) {
    return meshCactus(seed, level);
  }

  if (species === PlantSpecies.Boulder) {
    return meshBoulder(seed, level);
  }

  const generator = TREE_GENERATORS[species];
  const look = TREE_LOOKS[species];

  if (generator === undefined || look === undefined) {
    throw new RangeError(`No model for plant species ${PLANT_SPECIES[species].name}`);
  }

  const structure = generator(seed);

  const tree = meshTree(structure, look, level);

  if (species !== PlantSpecies.Bush || level === "low") {
    return tree;
  }

  return mergeMeshes([tree, berries(tree, structure, look, seed + 1, level)]);
}

export function buildPlantVariants(species: PlantSpeciesIndex, level: PlantDetailLevel): MeshData[] {
  return Array.from({ length: PLANT_VARIANT_COUNT }, (_, variant) => meshVariant(species, variant, level));
}

export function canonicalHeight(species: PlantSpeciesIndex): number {
  return CANONICAL_HEIGHTS[species];
}
