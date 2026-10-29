import { useEffect, useState } from "react";

export function useNow(intervalMilliseconds: number): number {
  const [now, setNow] = useState(() => {
    return Date.now();
  });

  useEffect(() => {
    const interval = window.setInterval(() => {
      return setNow(Date.now());
    }, intervalMilliseconds);

    return () => {
      return window.clearInterval(interval);
    };
  }, [intervalMilliseconds]);

  return now;
}
