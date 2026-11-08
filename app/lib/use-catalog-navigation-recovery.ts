"use client";
import { useEffect, useRef } from 'react';

/** A cached thin router model can outlive the browser catalog. A failed
 * catalog read gets one ordinary server refresh, never a navigation loop. */
export function useCatalogNavigationRecovery(path: string, needed: boolean, refresh: () => void) {
  const attempted = useRef<string | null>(null);
  useEffect(() => {
    if (needed && attempted.current !== path) {
      attempted.current = path;
      refresh();
    }
  }, [path, needed, refresh]);
}
