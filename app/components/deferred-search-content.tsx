"use client";

import { useId, type ReactNode } from "react";
import { useSectionActivation } from "./use-section-activation";

/** Advisory content keeps its original eager SSR unless its caller explicitly
 * opts into viewport activation. Results, totals and booking never wait here. */
export function DeferredSearchContent({ children, label, deferUntilNearViewport = false }: { children: ReactNode; label: string; deferUntilNearViewport?: boolean }) {
  const id = useId();
  const active = useSectionActivation(id, deferUntilNearViewport);
  if (!deferUntilNearViewport) return <>{children}</>;
  return <div id={id} role="region" aria-label={label} tabIndex={0} style={active ? undefined : { minHeight: 1 }}>
    {active ? children : null}
  </div>;
}
