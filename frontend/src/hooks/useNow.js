import { useEffect, useState } from 'react';

// Returns Date.now() that updates every `intervalMs` ms.
// Use this to make "X seconds ago" tick live without page refresh.
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
