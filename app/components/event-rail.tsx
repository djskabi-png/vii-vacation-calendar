"use client";

import { useRef, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function EventRail({ title, children }: { title: string; children: ReactNode }) {
  const rail = useRef<HTMLDivElement>(null);
  function move(direction: -1 | 1) {
    const node = rail.current;
    if (!node) return;
    const card = node.firstElementChild as HTMLElement | null;
    const step = (card?.getBoundingClientRect().width || 300) + 14;
    node.scrollBy({ left: direction * step * (getComputedStyle(node).direction === "rtl" ? -1 : 1), behavior: "smooth" });
  }
  return <div className="event-rail-wrap">
    <div className="event-rail-controls" role="group" aria-label={title}>
      <button type="button" onClick={() => move(-1)} aria-label={`הקודם ב${title}`} title="הקודם"><ChevronRight aria-hidden="true" /></button>
      <button type="button" onClick={() => move(1)} aria-label={`הבא ב${title}`} title="הבא"><ChevronLeft aria-hidden="true" /></button>
    </div>
    <div className="event-rail" ref={rail} aria-label={title}>{children}</div>
  </div>;
}
