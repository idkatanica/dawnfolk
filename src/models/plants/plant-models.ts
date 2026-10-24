import { PIECE_FORMS } from "../../content/monuments.ts";
import { PLANT_SPECIES, PlantSpecies, type PlantSpeciesIndex } from "../../content/plants.ts";
import { MaterialSlot } from "../materials.ts";
import { type MeshData, mergeMeshes, vertexCount } from "../mesh/mesh-data.ts";
import { isMonumentModel, MONUMENT_HEIGHTS, meshMonument } from "../structures/monuments.ts";
import { BERRY_PART, berryClusters } from "./berries.ts";
import { CACTUS_FORMS, cactusForm, meshCactus } from "./cacti.ts";
import { isOrchardModel, meshOrchardPlant, ORCHARD_HEIGHTS, ORCHARD_VARIANT_COUNTS } from "./orchard-plants.ts";
import { isRockModel, meshRock, ROCK_HEIGHTS, ROCK_VARIANT_COUNTS } from "./rocks.ts";
import { isDistantLevel, meshTree, type PlantDetailLevel, type TreeLook } from "./tree-mesher.ts";
import { DESERT_SHRUB_FORM_COUNT, TREE_GENERATORS, TREE_HEIGHTS } from "./tree-species.ts";

const VARIANT_COUNTS: Readonly<Record<PlantSpeciesIndex, number>> = {
  ...ROCK_VARIANT_COUNTS,
  ...ORCHARD_VARIANT_COUNTS,
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
  ...ORCHARD_HEIGHTS,
};

const FORM_PER_VARIANT: ReadonlySet<PlantSpeciesIndex> = new Set([
  PlantSpecies.Cactus,
  PlantSpecies.DesertShrub,
  PlantSpecies.Idol,
  PlantSpecies.Menhir,
  PlantSpecies.Pillar,
]);

export const PLANT_DETAIL_LEVELS: readonly PlantDetailLevel[] = ["high", "medium", "low", "far"];

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

export function buildPlantVariant(species: PlantSpeciesIndex, variant: number, level: PlantDetailLevel): MeshData {
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

  if (isOrchardModel(species)) {
    return meshOrchardPlant(species, seed, level, BERRY_PART);
  }

  const generator = TREE_GENERATORS[species];
  const look = TREE_LOOKS[species];

  if (generator === undefined || look === undefined) {
    throw new RangeError(`No model for plant species ${PLANT_SPECIES[species].name}`);
  }

  const structure = generator(seed, variant);
  const tree = meshTree(structure, look, level);

  if (species !== PlantSpecies.Bush || isDistantLevel(level)) {
    return tree;
  }

  return mergeMeshes([tree, berryClusters(tree, structure, look, seed + 1, level)]);
}

export function plantVariantCount(species: PlantSpeciesIndex): number {
  return VARIANT_COUNTS[species];
}

export function farVariantOf(species: PlantSpeciesIndex, variant: number): number {
  return FORM_PER_VARIANT.has(species) ? variant : 0;
}

export function buildPlantVariants(species: PlantSpeciesIndex, level: PlantDetailLevel): MeshData[] {
  return Array.from({ length: plantVariantCount(species) }, (_, variant) => buildPlantVariant(species, variant, level));
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
