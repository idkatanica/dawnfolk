export const MaterialSlot = {
  Accent: 5,
  Antler: 22,
  Ash: 18,
  Bark: 9,
  Berry: 13,
  BirchBark: 10,
  Blossom: 14,
  Bone: 6,
  Cactus: 27,
  Coat: 19,
  CoatLight: 20,
  Daub: 17,
  Deadwood: 31,
  Ember: 29,
  Eye: 2,
  Fish: 26,
  Fur: 3,
  Grain: 24,
  Hair: 1,
  Hide: 4,
  Hoof: 21,
  Horn: 32,
  Leaf: 11,
  Lip: 28,
  Meat: 25,
  Moss: 15,
  Needle: 12,
  Rope: 30,
  Skin: 0,
  Stone: 8,
  Thatch: 16,
  Tusk: 23,
  Wood: 7,
} as const;

export type MaterialSlotIndex = (typeof MaterialSlot)[keyof typeof MaterialSlot];

const MATERIAL_SLOT_COUNT = 33;

const COLORS_BY_SLOT: Readonly<Record<MaterialSlotIndex, number>> = {
  [MaterialSlot.Accent]: 0xc4_55_3a,
  [MaterialSlot.Antler]: 0xcd_b8_94,
  [MaterialSlot.Ash]: 0x3a_35_32,
  [MaterialSlot.Bark]: 0x5f_4a_3a,
  [MaterialSlot.BirchBark]: 0xe9_e4_d8,
  [MaterialSlot.Berry]: 0xb8_26_3a,
  [MaterialSlot.Blossom]: 0xee_7c_a2,
  [MaterialSlot.Bone]: 0xe8_dc_c4,
  [MaterialSlot.Cactus]: 0x4f_8a_4a,
  [MaterialSlot.Coat]: 0x8a_5a_36,
  [MaterialSlot.CoatLight]: 0xd9_c2_a0,
  [MaterialSlot.Daub]: 0xb0_8a_62,
  [MaterialSlot.Deadwood]: 0x8f_85_77,
  [MaterialSlot.Ember]: 0xff_7a_2a,
  [MaterialSlot.Eye]: 0x1d_17_14,
  [MaterialSlot.Fish]: 0x9f_b0_b8,
  [MaterialSlot.Fur]: 0x8a_6a_4a,
  [MaterialSlot.Grain]: 0xd9_b8_60,
  [MaterialSlot.Hair]: 0x3b_2a_20,
  [MaterialSlot.Hide]: 0xa5_77_4f,
  [MaterialSlot.Hoof]: 0x3a_2e_26,
  [MaterialSlot.Horn]: 0x5e_54_48,
  [MaterialSlot.Leaf]: 0x5e_8f_3a,
  [MaterialSlot.Lip]: 0x9a_5a_50,
  [MaterialSlot.Meat]: 0xa8_44_3a,
  [MaterialSlot.Moss]: 0x6f_8a_3e,
  [MaterialSlot.Needle]: 0x2f_5a_3a,
  [MaterialSlot.Rope]: 0xb5_9a_6a,
  [MaterialSlot.Skin]: 0xc9_9a_7a,
  [MaterialSlot.Stone]: 0x8d_8a_83,
  [MaterialSlot.Thatch]: 0xc8_a6_60,
  [MaterialSlot.Tusk]: 0xef_e6_d2,
  [MaterialSlot.Wood]: 0x8b_6a_48,
};

function buildColorTable(): number[] {
  const table = new Array<number>(MATERIAL_SLOT_COUNT).fill(0);

  for (const slot of Object.values(MaterialSlot)) {
    table[slot] = COLORS_BY_SLOT[slot];
  }

  return table;
}

export const SLOT_COLOR_TABLE: readonly number[] = buildColorTable();
