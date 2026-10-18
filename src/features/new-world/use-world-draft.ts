import { type ChangeEvent, useState } from "react";
import { LARGEST_SEED, randomSeed } from "../../app/launch-options.ts";
import { type IslandShapeKind, isIslandShapeKind } from "../../world/island-shape.ts";
import { readWorldName, worldNameFor } from "./world-names.ts";

export interface WorldChoice {
  readonly name: string;
  readonly seed: number;
  readonly shape: IslandShapeKind;
}

function readSeed(text: string): number | null {
  const seed = Number(text.trim());

  if (!Number.isInteger(seed) || seed < 1 || seed > LARGEST_SEED) {
    return null;
  }

  return seed;
}

export function useWorldDraft(initial: WorldChoice) {
  const [nameText, setNameText] = useState(initial.name);
  const [seedText, setSeedText] = useState(() => String(initial.seed));
  const [shape, setShape] = useState(initial.shape);

  const name = readWorldName(nameText);
  const seed = readSeed(seedText);

  function changeName(event: ChangeEvent<HTMLInputElement>): void {
    setNameText(event.target.value);
  }

  function rollName(): void {
    setNameText(worldNameFor(randomSeed()));
  }

  function changeSeed(event: ChangeEvent<HTMLInputElement>): void {
    setSeedText(event.target.value);
  }

  function rollSeed(): void {
    setSeedText(String(randomSeed()));
  }

  function changeShape(value: string): void {
    if (isIslandShapeKind(value)) {
      setShape(value);
    }
  }

  const choice: WorldChoice | null = name === null || seed === null ? null : { name, seed, shape };

  return { changeName, changeSeed, changeShape, choice, nameText, rollName, rollSeed, seedText, shape };
}
