import { type ChangeEvent, type FormEvent, useState } from "react";
import { type IslandShapeKind, isIslandShapeKind } from "../../world/island-shape.ts";
import { randomSeed, readSeed } from "./seeds.ts";
import { readWorldName, worldNameFor } from "./world-names.ts";

interface WorldChoice {
  readonly name: string;
  readonly seed: number;
  readonly shape: IslandShapeKind;
}

export function useWorldDraft(initial: WorldChoice, onCreate: (choice: WorldChoice) => void) {
  const [nameText, setNameText] = useState(initial.name);
  const [seedText, setSeedText] = useState(String(initial.seed));
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

  function create(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    if (choice !== null) {
      onCreate(choice);
    }
  }

  return { changeName, changeSeed, changeShape, choice, create, nameText, rollName, rollSeed, seedText, shape };
}
