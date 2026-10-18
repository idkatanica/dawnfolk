export type ChronicleCategory =
  | "arrival"
  | "birth"
  | "building"
  | "death"
  | "discovery"
  | "fire"
  | "food"
  | "gift"
  | "hunt"
  | "migration"
  | "split"
  | "warning"
  | "weather";

interface ChronicleRecord {
  category: ChronicleCategory;
  text: string;
  tribeId: number | null;
  x: number;
  z: number;
}

export interface ChronicleEntry extends ChronicleRecord {
  day: number;
  id: number;
}

export class Chronicle {
  #entries: ChronicleEntry[] = [];
  #nextId = 1;
  day = 0;

  record(record: ChronicleRecord): void {
    this.#entries.push({ ...record, day: this.day, id: this.#nextId });
    this.#nextId += 1;
  }

  takeEntries(): ChronicleEntry[] {
    const entries = this.#entries;

    this.#entries = [];

    return entries;
  }
}
