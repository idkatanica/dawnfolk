const FIGHT_POSES = ["march", "charge", "thrust", "brawl", "block", "flinch", "fall"] as const;

const ANIMAL_FIGHT_POSES = ["attack", "charge", "flinch", "fall"] as const;

export const PERSON_POSES = [
  "idle",
  "walk",
  "run",
  "carry",
  "gather",
  "chop",
  "dig",
  "fish",
  "build",
  "throw",
  "eat",
  "sit",
  "sleep",
  "pray",
  "play",
  "dead",
  "shoot",
  "mine",
  "leap",
  ...FIGHT_POSES,
] as const;

export const ANIMAL_POSES = ["graze", "walk", "run", "dead", ...ANIMAL_FIGHT_POSES] as const;

export const CARRIED_ITEMS = [
  "nothing",
  "berries",
  "meat",
  "fish",
  "crops",
  "wood",
  "stone",
  "ore",
  "clay",
  "fruit",
] as const;

export type FightPose = (typeof FIGHT_POSES)[number];

export type PersonPose = (typeof PERSON_POSES)[number];

export type AnimalFightPose = (typeof ANIMAL_FIGHT_POSES)[number];

export type AnimalPose = (typeof ANIMAL_POSES)[number];

export type CarriedItem = (typeof CARRIED_ITEMS)[number];

export function personPoseCode(pose: PersonPose): number {
  return PERSON_POSES.indexOf(pose);
}

export function animalPoseCode(pose: AnimalPose): number {
  return ANIMAL_POSES.indexOf(pose);
}

export function carriedItemCode(item: CarriedItem): number {
  return CARRIED_ITEMS.indexOf(item);
}
