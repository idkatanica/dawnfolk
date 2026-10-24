import type { GameIconName } from "../../design/game-icon-sources.ts";
import type { ChronicleCategory } from "../../simulation/chronicle.ts";

export const CHRONICLE_ICONS: Readonly<Record<ChronicleCategory, GameIconName>> = {
  arrival: "tent",
  beast: "paw",
  birth: "birth",
  building: "workshop",
  death: "death",
  discovery: "inspiration",
  era: "totem",
  feud: "shield",
  fire: "fire",
  food: "grain",
  gift: "gift",
  hunt: "bows",
  migration: "migration",
  peace: "peace",
  raid: "raid",
  split: "split",
  warning: "warning",
  weather: "storm",
};
