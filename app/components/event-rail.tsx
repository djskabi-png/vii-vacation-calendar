"use client";

import { useId, useRef, type ReactNode } from "react";
import { SliderRailControls } from "./slider-rail-controls";

export function EventRail({ title, children }: { title: string; children: ReactNode }) {
  const rail = useRef<HTMLDivElement>(null);
  const railId = useId();
  return <div className="event-rail-wrap">
    <SliderRailControls railId={railId} railRef={rail} label={title} className="event-rail-controls" />
    <div id={railId} className="event-rail" ref={rail} data-horizontal-rail aria-label={title}>{children}</div>
  </div>;
}
