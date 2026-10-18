import { describe, expect, it } from "vitest";
import { PLANT_SPECIES, PlantSpecies, type PlantSpeciesIndex, plantSpeciesDefinition } from "../../content/plants.ts";
import { MaterialSlot } from "../materials.ts";
import { type MeshData, triangleCount, vertexCount } from "../mesh/mesh-data.ts";
import { meshProblems } from "../testing/mesh-checks.ts";
import { describePiece, detachedPieces, meshPieces } from "../testing/mesh-connectivity.ts";
import { windBentMesh } from "../testing/moved-mesh.ts";
import { CACTUS_FORMS, cactusForm } from "./cacti.ts";
import {
  BERRY_PART,
  buildPlantVariants,
  canonicalHeight,
  footprintRadius,
  PLANT_DETAIL_LEVELS,
  plantVariantCount,
} from "./plant-models.ts";
import { FOLIAGE_FLUTTER, plantSway } from "./tree-mesher.ts";

const TOUCHING = 0.01;
const RADIUS_TOLERANCE = 0.2;
const STORM_PUSH = 2;

const SPECIES: readonly PlantSpeciesIndex[] = PLANT_SPECIES.map((definition) => definition.index);
const FOLIAGE_SLOTS: ReadonlySet<number> = new Set([MaterialSlot.Leaf, MaterialSlot.Needle]);
const TREES = [
  PlantSpecies.Acacia,
  PlantSpecies.Birch,
  PlantSpecies.Maple,
  PlantSpecies.Oak,
  PlantSpecies.Palm,
  PlantSpecies.Pine,
  PlantSpecies.Poplar,
  PlantSpecies.Spruce,
  PlantSpecies.Willow,
];
const MIXED_FORMS: ReadonlySet<PlantSpeciesIndex> = new Set([PlantSpecies.Cactus, PlantSpecies.DeadTree]);

function widestRadius(species: PlantSpeciesIndex): number {
  let widest = 0;

  for (const mesh of buildPlantVariants(species, "high")) {
    for (let vertex = 0; vertex < vertexCount(mesh); vertex += 1) {
      widest = Math.max(widest, Math.hypot(mesh.positions[vertex * 3], mesh.positions[vertex * 3 + 2]));
    }
  }

  return widest;
}

function workingRadius(species: PlantSpeciesIndex): number {
  const { form } = plantSpeciesDefinition(species);

  if (form === "shrub" || form === "stone") {
    return widestRadius(species);
  }

  return footprintRadius(species);
}

function averageTriangles(species: PlantSpeciesIndex, level: (typeof PLANT_DETAIL_LEVELS)[number]): number {
  const variants = buildPlantVariants(species, level);

  return variants.reduce((sum, mesh) => sum + triangleCount(mesh), 0) / variants.length;
}

describe.each(SPECIES)("plant species %i", (species) => {
  it("builds clean variants at every level of detail", () => {
    for (const level of PLANT_DETAIL_LEVELS) {
      const variants = buildPlantVariants(species, level);

      expect(variants).toHaveLength(plantVariantCount(species));

      for (const mesh of variants) {
        expect(meshProblems(mesh)).toEqual([]);
      }
    }
  });

  it("stands on the ground at about its canonical height", () => {
    const height = canonicalHeight(species);
    const shortest = MIXED_FORMS.has(species) ? 0.3 : 0.62;

    const variants = buildPlantVariants(species, "high");

    for (const mesh of variants) {
      expect(mesh.bounds.minimum[1]).toBeGreaterThan(-0.5);
      expect(mesh.bounds.minimum[1]).toBeLessThan(height * 0.2);
      expect(mesh.bounds.maximum[1]).toBeGreaterThan(height * shortest);
      expect(mesh.bounds.maximum[1]).toBeLessThan(height * 1.25);
    }

    expect(Math.max(...variants.map((mesh) => mesh.bounds.maximum[1]))).toBeGreaterThan(height * 0.62);
  });

  it("spends fewer triangles further away", () => {
    expect(averageTriangles(species, "medium")).toBeLessThan(averageTriangles(species, "high"));
    expect(averageTriangles(species, "low")).toBeLessThan(averageTriangles(species, "medium"));
  });

  it("gives the same model for the same variant", () => {
    const [first] = buildPlantVariants(species, "medium");
    const [again] = buildPlantVariants(species, "medium");

    expect(again.positions).toEqual(first.positions);
  });

  it("tells the simulation how far it reaches where people work on it", () => {
    const measured = workingRadius(species) / canonicalHeight(species);

    expect(Math.abs(plantSpeciesDefinition(species).radiusPerMeter - measured)).toBeLessThan(
      measured * RADIUS_TOLERANCE
    );
  });

  it("keeps every part of every variant attached to the ground", () => {
    for (const level of PLANT_DETAIL_LEVELS) {
      for (const [variant, mesh] of buildPlantVariants(species, level).entries()) {
        const detached = detachedPieces(mesh, TOUCHING).map((piece) => describePiece(mesh, piece));

        expect(detached, `${level} variant ${variant}`).toEqual([]);
      }
    }
  });

  it("keeps every part attached while a storm bends it", () => {
    for (const level of PLANT_DETAIL_LEVELS) {
      for (const [variant, mesh] of buildPlantVariants(species, level).entries()) {
        const bent = windBentMesh(mesh, STORM_PUSH);

        const detached = detachedPieces(bent, TOUCHING).map((piece) => describePiece(bent, piece));

        expect(detached, `${level} variant ${variant}`).toEqual([]);
      }
    }
  });
});

function highestVertex(mesh: MeshData, vertices: readonly number[]): number {
  return vertices.reduce((highest, vertex) =>
    mesh.positions[vertex * 3 + 1] > mesh.positions[highest * 3 + 1] ? vertex : highest
  );
}

describe("tree details", () => {
  it.each(TREES)("flutters only the foliage of species %i and sways it more than the trunk foot", (species) => {
    const [mesh] = buildPlantVariants(species, "high");

    const vertices = Array.from({ length: vertexCount(mesh) }, (_, vertex) => vertex);

    function isFoliage(vertex: number): boolean {
      return FOLIAGE_SLOTS.has(mesh.channels.slot[vertex]);
    }

    const foliage = vertices.filter(isFoliage);
    const wood = vertices.filter((vertex) => !isFoliage(vertex));

    const foot = wood.filter((vertex) => mesh.positions[vertex * 3 + 1] < canonicalHeight(species) / 3);

    function averageSway(group: readonly number[]): number {
      return group.reduce((sum, vertex) => sum + mesh.channels.sway[vertex], 0) / group.length;
    }

    expect(foliage.length).toBeGreaterThan(0);
    expect(foliage.every((vertex) => mesh.channels.flutter[vertex] === FOLIAGE_FLUTTER)).toBe(true);
    expect(wood.every((vertex) => mesh.channels.flutter[vertex] === 0)).toBe(true);
    expect(averageSway(foliage)).toBeGreaterThan(averageSway(foot));
  });

  it("sways the top of every willow crown with the tree", () => {
    for (const level of ["high", "medium"] as const) {
      for (const willow of buildPlantVariants(PlantSpecies.Willow, level)) {
        const foliage = meshPieces(willow).filter(
          (piece) => willow.channels.flutter[piece.vertices[0]] === FOLIAGE_FLUTTER
        );

        for (const piece of foliage) {
          const top = highestVertex(willow, piece.vertices);

          const crownSway = plantSway(willow.positions[top * 3 + 1], canonicalHeight(PlantSpecies.Willow));

          expect(willow.channels.sway[top], level).toBeCloseTo(crownSway, 2);
        }
      }
    }
  });

  it("moves berries with the leaves they grow on", () => {
    for (const level of ["high", "medium"] as const) {
      for (const bush of buildPlantVariants(PlantSpecies.Bush, level)) {
        const vertices = Array.from({ length: vertexCount(bush) }, (_, vertex) => vertex);

        const berries = vertices.filter((vertex) => bush.channels.part[vertex] === BERRY_PART);

        expect(berries.length).toBeGreaterThan(0);

        for (const vertex of berries) {
          const crownSway = plantSway(bush.positions[vertex * 3 + 1], canonicalHeight(PlantSpecies.Bush));

          expect(bush.channels.sway[vertex]).toBeCloseTo(crownSway, 5);
          expect(bush.channels.flutter[vertex]).toBe(FOLIAGE_FLUTTER);
        }
      }
    }
  });

  it("grows a different kind of cactus from each variant", () => {
    const [saguaro, organPipe, barrel, pricklyPear] = buildPlantVariants(PlantSpecies.Cactus, "high");

    expect(CACTUS_FORMS.map((_form, variant) => cactusForm(variant))).toEqual(CACTUS_FORMS);
    expect(saguaro.bounds.maximum[1]).toBeGreaterThan(3);
    expect(meshPieces(organPipe).filter((piece) => piece.triangles.length > 60).length).toBeGreaterThan(3);
    expect(barrel.bounds.maximum[1]).toBeLessThan(1.6);
    expect(pricklyPear.channels.slot).toContain(MaterialSlot.Berry);
    expect(saguaro.channels.slot).toContain(MaterialSlot.Blossom);
  });

  it("leaves dead trees bare in every season", () => {
    for (const level of PLANT_DETAIL_LEVELS) {
      for (const snag of buildPlantVariants(PlantSpecies.DeadTree, level)) {
        expect([...snag.channels.slot].some((slot) => FOLIAGE_SLOTS.has(slot))).toBe(false);
        expect(snag.channels.slot).toContain(MaterialSlot.Deadwood);
      }
    }
  });

  it("marks birch bark and hangs berries only on near bushes", () => {
    const [birch] = buildPlantVariants(PlantSpecies.Birch, "high");
    const [nearBush] = buildPlantVariants(PlantSpecies.Bush, "high");
    const [farBush] = buildPlantVariants(PlantSpecies.Bush, "low");

    expect(birch.channels.slot).toContain(MaterialSlot.BirchBark);
    expect(birch.channels.slot).toContain(MaterialSlot.Bark);
    expect(nearBush.channels.part).toContain(BERRY_PART);
    expect(farBush.channels.part).not.toContain(BERRY_PART);
  });
});
