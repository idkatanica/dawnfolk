export const ADULT_AGE = 12;

export const ELDER_AGE = 50;

export type AgeGroup = "adult" | "child" | "elder";

export function ageGroupOf(age: number): AgeGroup {
  if (age < ADULT_AGE) {
    return "child";
  }

  if (age > ELDER_AGE) {
    return "elder";
  }

  return "adult";
}
