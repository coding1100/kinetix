"use client";

import { useCallback, useState } from "react";

export function useBusy(initial = false) {
  const [busy, setBusy] = useState(initial);

  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    setBusy(true);
    try {
      return await fn();
    } finally {
      setBusy(false);
    }
  }, []);

  return { busy, setBusy, run };
}
