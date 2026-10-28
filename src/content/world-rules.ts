import { z } from "zod";
import { groupMetadata, rangeParameter } from "./parameters.ts";

export const worldRulesSchema = z.object({
  fire: z
    .object({
      burnDuration: multiplier("Burn time", "How long each patch of grass and forest keeps burning."),
      embers: multiplier("Embers", "How often burning crowns throw embers ahead of the front.", 3, 0),
      flammability: multiplier("Flammability", "How easily heat sets fresh ground alight."),
      slopeInfluence: multiplier("Uphill push", "How much faster fire climbs slopes.", 2.5, 0),
      spreadSpeed: multiplier("Spread speed", "How quickly flames heat their neighbors."),
      windInfluence: multiplier("Wind push", "How strongly wind drives the fire front.", 2.5, 0),
    })
    .prefault({})
    .meta(groupMetadata("Fire", "How wildfires start, spread and burn out.")),
  life: z
    .object({
      birthRate: multiplier("Births", "How often families have children.", 3, 0),
      hungerRate: multiplier("Hunger", "How quickly people get hungry.", 2, 0.3),
      learningSpeed: multiplier("Learning", "How quickly tribes make discoveries.", 5),
      rivalry: multiplier("Rivalry", "How quickly neighboring tribes fall out, raid and fight.", 3, 0),
    })
    .prefault({})
    .meta(groupMetadata("People", "How tribes grow, eat and learn.")),
  nature: z
    .object({
      animalBirthRate: multiplier("Animal births", "How fast herds grow in spring.", 3, 0),
      beastBoldness: multiplier("Beast boldness", "How readily wolves, mammoths and stags attack people.", 3, 0),
      berryGrowth: multiplier("Berries", "How fast bushes bear fruit."),
      forestRegrowth: multiplier("Forest regrowth", "How quickly forests return to open and burnt land.", 3, 0),
    })
    .prefault({})
    .meta(groupMetadata("Nature", "Growth of plants and animals.")),
  storms: z
    .object({
      lightningFrequency: multiplier("Lightning", "How often storms throw lightning.", 3, 0),
      lightningIgnition: rangeParameter({
        defaultValue: 75,
        description: "Chance that a natural strike starts a fire.",
        label: "Strike fires",
        maximum: 100,
        minimum: 0,
        step: 5,
        unit: "percent",
      }),
      windStrength: multiplier("Wind", "Overall strength of the wind.", 2, 0),
    })
    .prefault({})
    .meta(groupMetadata("Storms", "Lightning and wind.")),
  water: z
    .object({
      drying: multiplier("Drying", "How quickly wet ground dries in the sun."),
      rainStrength: multiplier("Rain", "How strongly rain douses fires and soaks the ground."),
      snowfall: multiplier("Snowfall", "How quickly snow piles up below freezing."),
      snowMelt: multiplier("Snow melt", "How quickly snow melts above freezing."),
    })
    .prefault({})
    .meta(groupMetadata("Rain and snow", "Moisture, rain and snow cover.")),
});

export type WorldRules = z.output<typeof worldRulesSchema>;

export const DEFAULT_WORLD_RULES: WorldRules = worldRulesSchema.parse({});

function multiplier(label: string, description: string, maximum = 3, minimum = 0.2) {
  return rangeParameter({ defaultValue: 1, description, label, maximum, minimum, step: 0.1, unit: "multiplier" });
}

export function readWorldRules(value: unknown): WorldRules {
  const result = worldRulesSchema.safeParse(value);

  if (!result.success) {
    console.warn("Ignoring invalid world rules", result.error.issues);

    return DEFAULT_WORLD_RULES;
  }

  return result.data;
}
