import { describe, expect, it } from "vitest";
import { PLANT_SPECIES, PlantSpecies, type PlantSpeciesIndex } from "../../content/plants.ts";
import { MaterialSlot } from "../materials.ts";
import { type MeshData, triangleCount, vertexCount } from "../mesh/mesh-data.ts";
import { meshProblems } from "../testing/mesh-checks.ts";
import { describePiece, detachedPieces, meshPieces } from "../testing/mesh-connectivity.ts";
import { windBentMesh } from "../testing/moved-mesh.ts";
import {
  BERRY_PART,
  buildPlantVariants,
  canonicalHeight,
  PLANT_DETAIL_LEVELS,
  PLANT_VARIANT_COUNT,
} from "./plant-models.ts";
import { FOLIAGE_FLUTTER, plantSway } from "./tree-mesher.ts";

const TOUCHING = 0.01;
const STORM_PUSH = 2;

const SPECIES: readonly PlantSpeciesIndex[] = PLANT_SPECIES.map((definition) => definition.index);
const FOLIAGE_SLOTS: ReadonlySet<number> = new Set([MaterialSlot.Leaf, MaterialSlot.Needle]);
const TREES = [
  PlantSpecies.Birch,
  PlantSpecies.Maple,
  PlantSpecies.Oak,
  PlantSpecies.Pine,
  PlantSpecies.Spruce,
  PlantSpecies.Willow,
];

function averageTriangles(species: PlantSpeciesIndex, level: (typeof PLANT_DETAIL_LEVELS)[number]): number {
  const variants = buildPlantVariants(species, level);

  return variants.reduce((sum, mesh) => sum + triangleCount(mesh), 0) / variants.length;
}

describe.each(SPECIES)("plant species %i", (species) => {
  it("builds clean variants at every level of detail", () => {
    for (const level of PLANT_DETAIL_LEVELS) {
      const variants = buildPlantVariants(species, level);

      expect(variants).toHaveLength(PLANT_VARIANT_COUNT);

      for (const mesh of variants) {
        expect(meshProblems(mesh)).toEqual([]);
      }
    }
  });

  it("stands on the ground at about its canonical height", () => {
    const height = canonicalHeight(species);

    for (const mesh of buildPlantVariants(species, "high")) {
      expect(mesh.bounds.minimum[1]).toBeGreaterThan(-0.5);
      expect(mesh.bounds.minimum[1]).toBeLessThan(height * 0.2);
      expect(mesh.bounds.maximum[1]).toBeGreaterThan(height * 0.62);
      expect(mesh.bounds.maximum[1]).toBeLessThan(height * 1.25);
    }
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
    const isFoliage = (vertex: number): boolean => FOLIAGE_SLOTS.has(mesh.channels.slot[vertex]);

    const foliage = vertices.filter(isFoliage);
    const wood = vertices.filter((vertex) => !isFoliage(vertex));

    const foot = wood.filter((vertex) => mesh.positions[vertex * 3 + 1] < canonicalHeight(species) / 3);

    const averageSway = (group: readonly number[]): number =>
      group.reduce((sum, vertex) => sum + mesh.channels.sway[vertex], 0) / group.length;

    expect(foliage.length).toBeGreaterThan(0);
    expect(foliage.every((vertex) => mesh.channels.flutter[vertex] === FOLIAGE_FLUTTER)).toBe(true);
    expect(wood.every((vertex) => mesh.channels.flutter[vertex] === 0)).toBe(true);
    expect(averageSway(foliage)).toBeGreaterThan(averageSway(foot));
  });

  it("starts every willow strand swaying with the crown it hangs from", () => {
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
