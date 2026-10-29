import { useEffect, useState } from "react";

const HOLD_MILLISECONDS = 700;

interface Draft<Value> {
  readonly value: Value;
}

export function useHeldDraft<Value>(confirmed: Value): readonly [Value, (value: Value) => void] {
  const [draft, setDraft] = useState<Draft<Value> | null>(null);

  useEffect(() => {
    if (draft === null) {
      return;
    }

    const timer = window.setTimeout(() => {
      setDraft(null);
    }, HOLD_MILLISECONDS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [draft]);

  function hold(value: Value): void {
    setDraft({ value });
  }

  if (draft === null) {
    return [confirmed, hold];
  }

  return [draft.value, hold];
}
