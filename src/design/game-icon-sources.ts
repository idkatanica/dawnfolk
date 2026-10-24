import arrows from "./icons/arrows.webp";
import berries from "./icons/berries.webp";
import birth from "./icons/birth.webp";
import bows from "./icons/bows.webp";
import bronze from "./icons/bronze.webp";
import campfire from "./icons/campfire.webp";
import clay from "./icons/clay.webp";
import cloud from "./icons/cloud.webp";
import copper from "./icons/copper.webp";
import copperOre from "./icons/copper-ore.webp";
import death from "./icons/death.webp";
import deer from "./icons/deer.webp";
import earthquake from "./icons/earthquake.webp";
import explosion from "./icons/explosion.webp";
import fire from "./icons/fire.webp";
import fish from "./icons/fish.webp";
import flatten from "./icons/flatten.webp";
import fog from "./icons/fog.webp";
import forest from "./icons/forest.webp";
import forge from "./icons/forge.webp";
import fruit from "./icons/fruit.webp";
import gift from "./icons/gift.webp";
import grain from "./icons/grain.webp";
import granary from "./icons/granary.webp";
import healing from "./icons/healing.webp";
import heat from "./icons/heat.webp";
import hut from "./icons/hut.webp";
import ibex from "./icons/ibex.webp";
import inspect from "./icons/inspect.webp";
import inspiration from "./icons/inspiration.webp";
import iron from "./icons/iron.webp";
import ironOre from "./icons/iron-ore.webp";
import kiln from "./icons/kiln.webp";
import lightning from "./icons/lightning.webp";
import linen from "./icons/linen.webp";
import longhouse from "./icons/longhouse.webp";
import lower from "./icons/lower.webp";
import mammoth from "./icons/mammoth.webp";
import meat from "./icons/meat.webp";
import meteor from "./icons/meteor.webp";
import migration from "./icons/migration.webp";
import mine from "./icons/mine.webp";
import moon from "./icons/moon.webp";
import neutral from "./icons/neutral.webp";
import overcast from "./icons/overcast.webp";
import paint from "./icons/paint.webp";
import palisade from "./icons/palisade.webp";
import paw from "./icons/paw.webp";
import peace from "./icons/peace.webp";
import person from "./icons/person.webp";
import population from "./icons/population.webp";
import pottery from "./icons/pottery.webp";
import raid from "./icons/raid.webp";
import rain from "./icons/rain.webp";
import raise from "./icons/raise.webp";
import shield from "./icons/shield.webp";
import smelter from "./icons/smelter.webp";
import smooth from "./icons/smooth.webp";
import snow from "./icons/snow.webp";
import snowCloud from "./icons/snow-cloud.webp";
import spears from "./icons/spears.webp";
import split from "./icons/split.webp";
import stone from "./icons/stone.webp";
import stoneHouse from "./icons/stone-house.webp";
import stoneWall from "./icons/stone-wall.webp";
import storehouse from "./icons/storehouse.webp";
import storm from "./icons/storm.webp";
import sun from "./icons/sun.webp";
import sunrise from "./icons/sunrise.webp";
import sunset from "./icons/sunset.webp";
import tent from "./icons/tent.webp";
import tinOre from "./icons/tin-ore.webp";
import totem from "./icons/totem.webp";
import vegetables from "./icons/vegetables.webp";
import warning from "./icons/warning.webp";
import wind from "./icons/wind.webp";
import wolf from "./icons/wolf.webp";
import wood from "./icons/wood.webp";
import workshop from "./icons/workshop.webp";

export const GAME_ICON_SOURCES = {
  arrows,
  berries,
  birth,
  bows,
  bronze,
  campfire,
  clay,
  cloud,
  copper,
  "copper-ore": copperOre,
  death,
  deer,
  earthquake,
  explosion,
  fire,
  fish,
  flatten,
  fog,
  forest,
  forge,
  fruit,
  gift,
  grain,
  granary,
  healing,
  heat,
  hut,
  ibex,
  inspect,
  inspiration,
  iron,
  "iron-ore": ironOre,
  kiln,
  lightning,
  linen,
  longhouse,
  lower,
  mammoth,
  meat,
  meteor,
  migration,
  mine,
  moon,
  neutral,
  overcast,
  paint,
  palisade,
  paw,
  peace,
  person,
  population,
  pottery,
  raid,
  rain,
  raise,
  shield,
  smelter,
  smooth,
  snow,
  "snow-cloud": snowCloud,
  spears,
  split,
  stone,
  "stone-house": stoneHouse,
  "stone-wall": stoneWall,
  storehouse,
  storm,
  sun,
  sunrise,
  sunset,
  tent,
  "tin-ore": tinOre,
  totem,
  vegetables,
  warning,
  wind,
  wolf,
  wood,
  workshop,
};

export type GameIconName = keyof typeof GAME_ICON_SOURCES;
