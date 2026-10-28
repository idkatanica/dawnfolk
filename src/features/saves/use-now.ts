import { useEffect, useState } from "react";

export function useNow(intervalMilliseconds: number): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), intervalMilliseconds);

    return () => window.clearInterval(interval);
  }, [intervalMilliseconds]);

  return now;
}
