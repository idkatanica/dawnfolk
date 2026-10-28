import type { RandomSource } from "../shared/random.ts";

export interface TribeIdentity {
  color: string;
  furColor: string;
  name: string;
}

const TRIBE_TOTEMS: readonly TribeIdentity[] = [
  { color: "#c8553d", furColor: "#6b4a33", name: "Bear Clan" },
  { color: "#3d7cc8", furColor: "#5e5a55", name: "Wolf Clan" },
  { color: "#5f9e4a", furColor: "#7a5a3a", name: "Elk Clan" },
  { color: "#b08a2e", furColor: "#8a6a44", name: "Lynx Clan" },
  { color: "#7a5ab8", furColor: "#3e3a40", name: "Raven Clan" },
  { color: "#c2477c", furColor: "#6e4e3c", name: "Heron Clan" },
  { color: "#2f9c94", furColor: "#5c4a38", name: "Otter Clan" },
  { color: "#d0782f", furColor: "#8e5a32", name: "Fox Clan" },
  { color: "#5a6fa8", furColor: "#4e4842", name: "Owl Clan" },
  { color: "#8a6b4a", furColor: "#4a3a2c", name: "Bison Clan" },
];

const FEMALE_NAMES: readonly string[] = [
  "Ayla",
  "Eena",
  "Maru",
  "Seka",
  "Liro",
  "Tala",
  "Nessa",
  "Ilka",
  "Runa",
  "Oma",
  "Kaya",
  "Ysa",
  "Brena",
  "Vela",
  "Tove",
  "Hesa",
  "Mira",
  "Asha",
];

const MALE_NAMES: readonly string[] = [
  "Torr",
  "Kael",
  "Brun",
  "Oren",
  "Dak",
  "Halo",
  "Ruk",
  "Esk",
  "Varn",
  "Tobo",
  "Grem",
  "Ulf",
  "Rokh",
  "Bero",
  "Kesh",
  "Arno",
  "Juro",
  "Pell",
];

export function tribeIdentity(tribeNumber: number): TribeIdentity {
  const identity = TRIBE_TOTEMS[tribeNumber % TRIBE_TOTEMS.length];
  const round = Math.floor(tribeNumber / TRIBE_TOTEMS.length);

  if (round === 0) {
    return identity;
  }

  return { ...identity, name: `${identity.name} ${round + 1}` };
}

export function personName(random: RandomSource, isFemale: boolean): string {
  if (isFemale) {
    return random.pick(FEMALE_NAMES);
  }

  return random.pick(MALE_NAMES);
}
