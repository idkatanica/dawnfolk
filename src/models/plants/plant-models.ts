import { Vector3 } from "three";
import { PIECE_FORMS } from "../../content/monuments.ts";
import { PLANT_SPECIES, PlantSpecies, type PlantSpeciesIndex } from "../../content/plants.ts";
import { FULL_TURN } from "../../shared/math.ts";
import { createRandom } from "../../shared/random.ts";
import { MaterialSlot } from "../materials.ts";
import { MeshBuilder } from "../mesh/mesh-builder.ts";
import { type MeshData, mergeMeshes, vertexCount } from "../mesh/mesh-data.ts";
import { sphere } from "../mesh/shapes.ts";
import { outermostHit } from "../mesh/surface-probe.ts";
import { transformOf } from "../mesh/transforms.ts";
import { isMonumentModel, MONUMENT_HEIGHTS, meshMonument } from "../structures/monuments.ts";
import { CACTUS_FORMS, cactusForm, meshCactus } from "./cacti.ts";
import { isRockModel, meshRock, ROCK_HEIGHTS, ROCK_VARIANT_COUNTS } from "./rocks.ts";
import { FOLIAGE_FLUTTER, meshTree, type PlantDetailLevel, plantSway, type TreeLook } from "./tree-mesher.ts";
import { DESERT_SHRUB_FORM_COUNT, TREE_GENERATORS, TREE_HEIGHTS } from "./tree-species.ts";
import type { TreeStructure } from "./tree-structure.ts";

const VARIANT_COUNTS: Readonly<Record<PlantSpeciesIndex, number>> = {
  ...ROCK_VARIANT_COUNTS,
  [PlantSpecies.Acacia]: 3,
  [PlantSpecies.Arch]: PIECE_FORMS[PlantSpecies.Arch].length,
  [PlantSpecies.Birch]: 4,
  [PlantSpecies.Bush]: 4,
  [PlantSpecies.Cairn]: PIECE_FORMS[PlantSpecies.Cairn].length,
  [PlantSpecies.Cactus]: CACTUS_FORMS.length,
  [PlantSpecies.DeadTree]: 3,
  [PlantSpecies.DesertShrub]: DESERT_SHRUB_FORM_COUNT,
  [PlantSpecies.Dolmen]: PIECE_FORMS[PlantSpecies.Dolmen].length,
  [PlantSpecies.Idol]: PIECE_FORMS[PlantSpecies.Idol].length,
  [PlantSpecies.Maple]: 4,
  [PlantSpecies.Menhir]: PIECE_FORMS[PlantSpecies.Menhir].length,
  [PlantSpecies.Oak]: 4,
  [PlantSpecies.Palm]: 2,
  [PlantSpecies.Pillar]: PIECE_FORMS[PlantSpecies.Pillar].length,
  [PlantSpecies.Pine]: 4,
  [PlantSpecies.Poplar]: 2,
  [PlantSpecies.Spruce]: 4,
  [PlantSpecies.Willow]: 4,
};

const CANONICAL_HEIGHTS: Readonly<Record<PlantSpeciesIndex, number>> = {
  ...TREE_HEIGHTS,
  ...ROCK_HEIGHTS,
  ...MONUMENT_HEIGHTS,
};

const FORM_PER_VARIANT: ReadonlySet<PlantSpeciesIndex> = new Set([
  PlantSpecies.Cactus,
  PlantSpecies.DesertShrub,
  PlantSpecies.Idol,
  PlantSpecies.Menhir,
  PlantSpecies.Pillar,
]);

export const PLANT_DETAIL_LEVELS: readonly PlantDetailLevel[] = ["high", "medium", "low"];

export const BERRY_PART = 1;

const BERRY_RADIUS = 0.07;

const FOOTPRINT_HEIGHT = 0.3;

const BROADLEAF: TreeLook = { bark: MaterialSlot.Bark, foliage: MaterialSlot.Leaf, hasBarkMarks: false };
const CONIFER: TreeLook = { bark: MaterialSlot.Bark, foliage: MaterialSlot.Needle, hasBarkMarks: false };
const BIRCH: TreeLook = { bark: MaterialSlot.BirchBark, foliage: MaterialSlot.Leaf, hasBarkMarks: true };
const PALM: TreeLook = { bark: MaterialSlot.Wood, foliage: MaterialSlot.Leaf, hasBarkMarks: true };
const DEADWOOD: TreeLook = { bark: MaterialSlot.Deadwood, foliage: MaterialSlot.Leaf, hasBarkMarks: false };

const TREE_LOOKS: Readonly<Partial<Record<PlantSpeciesIndex, TreeLook>>> = {
  [PlantSpecies.Acacia]: BROADLEAF,
  [PlantSpecies.Birch]: BIRCH,
  [PlantSpecies.Bush]: BROADLEAF,
  [PlantSpecies.DeadTree]: DEADWOOD,
  [PlantSpecies.DesertShrub]: DEADWOOD,
  [PlantSpecies.Maple]: BROADLEAF,
  [PlantSpecies.Oak]: BROADLEAF,
  [PlantSpecies.Palm]: PALM,
  [PlantSpecies.Pine]: CONIFER,
  [PlantSpecies.Poplar]: BROADLEAF,
  [PlantSpecies.Spruce]: CONIFER,
  [PlantSpecies.Willow]: BROADLEAF,
};

function variantSeed(species: PlantSpeciesIndex, variant: number): number {
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
  const blobs = structure.foliage.filter((foliage) => foliage.kind === "blob");
  const count = level === "high" ? 26 : 12;

  function isFoliage(triangle: number): boolean {
    return tree.channels.slot[tree.indices[triangle * 3]] === look.foliage;
  }

  for (let berry = 0; berry < count; berry += 1) {
    const host = random.pick(blobs);
    const angle = random.next() * FULL_TURN;
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
    return meshCactus(seed, level, cactusForm(variant));
  }

  if (isRockModel(species)) {
    return meshRock(species, seed, variant, level);
  }

  if (isMonumentModel(species)) {
    return meshMonument(species, seed, variant, level);
  }

  const generator = TREE_GENERATORS[species];
  const look = TREE_LOOKS[species];

  if (generator === undefined || look === undefined) {
    throw new RangeError(`No model for plant species ${PLANT_SPECIES[species].name}`);
  }

  const structure = generator(seed, variant);
  const tree = meshTree(structure, look, level);

  if (species !== PlantSpecies.Bush || level === "low") {
    return tree;
  }

  return mergeMeshes([tree, berries(tree, structure, look, seed + 1, level)]);
}

export function plantVariantCount(species: PlantSpeciesIndex): number {
  return VARIANT_COUNTS[species];
}

export function farVariantOf(species: PlantSpeciesIndex, variant: number): number {
  return FORM_PER_VARIANT.has(species) ? variant : 0;
}

export function buildPlantVariants(species: PlantSpeciesIndex, level: PlantDetailLevel): MeshData[] {
  return Array.from({ length: plantVariantCount(species) }, (_, variant) => meshVariant(species, variant, level));
}

export function canonicalHeight(species: PlantSpeciesIndex): number {
  return CANONICAL_HEIGHTS[species];
}

function baseRadius(mesh: MeshData): number {
  let radius = 0;

  for (let vertex = 0; vertex < vertexCount(mesh); vertex += 1) {
    const offset = vertex * 3;

    if (mesh.positions[offset + 1] < FOOTPRINT_HEIGHT) {
      radius = Math.max(radius, Math.hypot(mesh.positions[offset], mesh.positions[offset + 2]));
    }
  }

  return radius;
}

export function footprintRadius(species: PlantSpeciesIndex): number {
  return buildPlantVariants(species, "low").reduce((widest, mesh) => Math.max(widest, baseRadius(mesh)), 0);
}
