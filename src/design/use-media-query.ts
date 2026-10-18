import { useSyncExternalStore } from "react";

type Subscribe = (onChange: () => void) => () => void;

export const COMPACT_QUERY = "(max-width: 767px)";
export const TOUCH_QUERY = "(pointer: coarse)";

const subscribers = new Map<string, Subscribe>();

function subscriberFor(query: string): Subscribe {
  const existing = subscribers.get(query);

  if (existing !== undefined) {
    return existing;
  }

  function subscribe(onChange: () => void): () => void {
    const list = window.matchMedia(query);

    list.addEventListener("change", onChange);

    return () => list.removeEventListener("change", onChange);
  }

  subscribers.set(query, subscribe);

  return subscribe;
}

function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    subscriberFor(query),
    () => window.matchMedia(query).matches,
    () => false
  );
}

export function useIsCompact(): boolean {
  return useMediaQuery(COMPACT_QUERY);
}

export function useIsTouch(): boolean {
  return useMediaQuery(TOUCH_QUERY);
}
