export const PERSON_STRIDE = 14;

export const PersonField = {
  Age: 9,
  AppearanceSeed: 11,
  Carried: 12,
  Heading: 3,
  Health: 13,
  Id: 0,
  IsFemale: 10,
  Phase: 7,
  Pose: 6,
  TribeId: 8,
  VelocityX: 4,
  VelocityZ: 5,
  X: 1,
  Z: 2,
} as const;

export const ANIMAL_STRIDE = 11;

export const AnimalField = {
  AppearanceSeed: 10,
  Heading: 3,
  Id: 0,
  Kind: 8,
  Phase: 7,
  Pose: 6,
  VelocityX: 4,
  VelocityZ: 5,
  X: 1,
  Youth: 9,
  Z: 2,
} as const;

export const SURFACE_CHANNELS = 4;

export const SurfaceChannel = {
  Fire: 3,
  Scorch: 2,
  Snow: 0,
  Wetness: 1,
} as const;

export const GROUND_CHANNELS = 2;

export const GroundChannel = {
  Crop: 1,
  Ground: 0,
} as const;
