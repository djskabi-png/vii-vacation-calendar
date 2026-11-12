"use client";
import { useEffect, useState } from "react";
import { observeSectionActivation } from "../lib/section-activation";

export function useSectionActivation(id: string, deferred: boolean, rootMargin = "400px 0px") {
  const [active, setActive] = useState(!deferred);
  useEffect(() => {
    if (!deferred || active) return;
    const element = document.getElementById(id);
    if (!element) { setActive(true); return; }
    return observeSectionActivation(element, () => setActive(true), undefined, rootMargin);
  }, [active, deferred, id, rootMargin]);
  return !deferred || active;
}
