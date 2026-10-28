export type ChronicleCategory =
  | "arrival"
  | "beast"
  | "birth"
  | "building"
  | "death"
  | "discovery"
  | "era"
  | "feud"
  | "fire"
  | "food"
  | "gift"
  | "hunt"
  | "migration"
  | "peace"
  | "raid"
  | "split"
  | "warning"
  | "weather";

export interface ChronicleRecord {
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

export interface ChronicleSnapshot {
  day: number;
  entries: ChronicleEntry[];
  nextId: number;
}

export class Chronicle {
  #entries: ChronicleEntry[] = [];
  #nextId = 1;
  day = 0;

  snapshot(): ChronicleSnapshot {
    return { day: this.day, entries: structuredClone(this.#entries), nextId: this.#nextId };
  }

  restore(snapshot: ChronicleSnapshot): void {
    this.day = snapshot.day;
    this.#entries = snapshot.entries;
    this.#nextId = snapshot.nextId;
  }

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
