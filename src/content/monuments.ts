import { Biome, type BiomeIndex } from "./biomes.ts";
import { PlantSpecies } from "./plants.ts";

export type MonumentPiece =
  | typeof PlantSpecies.Arch
  | typeof PlantSpecies.Cairn
  | typeof PlantSpecies.Dolmen
  | typeof PlantSpecies.Idol
  | typeof PlantSpecies.Menhir
  | typeof PlantSpecies.Pillar;

export const PIECE_FORMS = {
  [PlantSpecies.Arch]: ["standing", "collapsed"],
  [PlantSpecies.Cairn]: ["tall", "low"],
  [PlantSpecies.Dolmen]: ["intact", "collapsed"],
  [PlantSpecies.Idol]: ["buried", "toppled"],
  [PlantSpecies.Menhir]: ["upright", "leaning", "broken", "fallen"],
  [PlantSpecies.Pillar]: ["standing", "stump", "fallen"],
} as const satisfies Readonly<Record<MonumentPiece, readonly string[]>>;

export type PieceForm<Piece extends MonumentPiece> = (typeof PIECE_FORMS)[Piece][number];

function pieceFormIndex<Piece extends MonumentPiece>(piece: Piece, form: PieceForm<Piece>): number {
  const forms: readonly string[] = PIECE_FORMS[piece];

  return forms.indexOf(form);
}

export function pieceSeed<Piece extends MonumentPiece>(piece: Piece, form: PieceForm<Piece>, jitter: number): number {
  return (pieceFormIndex(piece, form) + 0.1 + 0.8 * jitter) / PIECE_FORMS[piece].length;
}

export const MONUMENT_KINDS = ["stoneCircle", "menhirRow", "dolmen", "idol", "colonnade", "cairn"] as const;

export type MonumentKind = (typeof MONUMENT_KINDS)[number];

type MonumentSetting = "clearing" | "heights" | "plain";

interface MonumentDefinition {
  readonly biomes: readonly BiomeIndex[];
  readonly name: string;
  readonly names: readonly string[];
  readonly setting: MonumentSetting;
}

const OPEN_LAND: readonly BiomeIndex[] = [Biome.Meadow, Biome.Steppe, Biome.Scrub, Biome.Tundra];
const DRY_LAND: readonly BiomeIndex[] = [Biome.Desert, Biome.Steppe, Biome.Scrub, Biome.Mesa];
const WOODS: readonly BiomeIndex[] = [Biome.Forest, Biome.Taiga];

export const MONUMENTS: Readonly<Record<MonumentKind, MonumentDefinition>> = {
  cairn: {
    biomes: [Biome.Tundra, Biome.Alpine, Biome.Meadow, Biome.Steppe, Biome.Taiga],
    name: "Cairn",
    names: ["Watcher's Cairn", "Cold Cairn", "Howling Cairn", "Elders' Pile", "Wanderer's Mark", "Sky Cairn"],
    setting: "heights",
  },
  colonnade: {
    biomes: DRY_LAND,
    name: "Fallen colonnade",
    names: ["Broken Gate", "Hall of Pillars", "The Last Arch", "Sky Gate", "Empty Hall", "Pillars of Dusk"],
    setting: "plain",
  },
  dolmen: {
    biomes: [...WOODS, Biome.Meadow, Biome.Steppe],
    name: "Dolmen",
    names: ["Giant's Table", "Bone Table", "The Quoit", "Raven Stone", "Sleeper's Roof", "Elder's Bed"],
    setting: "clearing",
  },
  idol: {
    biomes: [...DRY_LAND, Biome.Meadow],
    name: "Stone head",
    names: ["The Sleeping Giant", "Forgotten King", "Old Face", "The Dreamer", "Silent Watcher", "The Listener"],
    setting: "plain",
  },
  menhirRow: {
    biomes: [...OPEN_LAND, Biome.Desert],
    name: "Stone row",
    names: ["The Long Watch", "Giants' March", "Grey Wethers", "Pilgrim Stones", "The Procession", "Dawn Row"],
    setting: "plain",
  },
  stoneCircle: {
    biomes: [...OPEN_LAND, ...WOODS],
    name: "Stone circle",
    names: ["The Nine Maidens", "Whispering Ring", "Sun Ring", "The Grey Dancers", "Moonstones", "Ring of Elders"],
    setting: "heights",
  },
};

export const MONUMENT_SLOPE = 0.3;
