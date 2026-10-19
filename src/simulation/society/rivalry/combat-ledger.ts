const STAGGER_SECONDS = 0.45;
const GUARD_SECONDS = 0.5;
const MEMORY_SECONDS = 12;

interface FighterRecord {
  assailantId: number;
  guardSeconds: number;
  memorySeconds: number;
  staggerSeconds: number;
}

export class CombatLedger {
  readonly #records = new Map<number, FighterRecord>();

  stagger(id: number, assailantId: number): void {
    const record = this.#recordOf(id);

    record.staggerSeconds = STAGGER_SECONDS;
    record.assailantId = assailantId;
    record.memorySeconds = MEMORY_SECONDS;
  }

  guard(id: number, assailantId: number): void {
    const record = this.#recordOf(id);

    record.guardSeconds = GUARD_SECONDS;
    record.assailantId = assailantId;
    record.memorySeconds = MEMORY_SECONDS;
  }

  isStaggered(id: number): boolean {
    const record = this.#records.get(id);

    return record !== undefined && record.staggerSeconds > 0;
  }

  isGuarding(id: number): boolean {
    const record = this.#records.get(id);

    return record !== undefined && record.guardSeconds > 0;
  }

  assailantOf(id: number): number | null {
    const record = this.#records.get(id);

    if (record === undefined) {
      return null;
    }

    return record.assailantId;
  }

  update(seconds: number): void {
    for (const [id, record] of this.#records) {
      record.staggerSeconds = Math.max(0, record.staggerSeconds - seconds);
      record.guardSeconds = Math.max(0, record.guardSeconds - seconds);
      record.memorySeconds -= seconds;

      if (record.memorySeconds <= 0) {
        this.#records.delete(id);
      }
    }
  }

  #recordOf(id: number): FighterRecord {
    const existing = this.#records.get(id);

    if (existing !== undefined) {
      return existing;
    }

    const record: FighterRecord = {
      assailantId: id,
      guardSeconds: 0,
      memorySeconds: MEMORY_SECONDS,
      staggerSeconds: 0,
    };

    this.#records.set(id, record);

    return record;
  }
}
