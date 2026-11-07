"use client";
import { useEffect, useState } from "react";
import { observeSectionActivation } from "../lib/section-activation";

export function useSectionActivation(id: string, deferred: boolean) {
  const [active, setActive] = useState(!deferred);
  useEffect(() => {
    if (!deferred || active) return;
    const element = document.getElementById(id);
    if (!element) { setActive(true); return; }
    return observeSectionActivation(element, () => setActive(true));
  }, [active, deferred, id]);
  return !deferred || active;
}
