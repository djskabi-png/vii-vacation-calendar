"use client";

import { useId, useLayoutEffect, useRef, type ReactNode } from "react";
import { SliderRailControls } from "./slider-rail-controls";
import { orderPlaceRailChildren } from "../lib/place-rail-children";
import { useDocumentSeed } from "./use-document-seed";

export function EventRail({ title, children, shufflePlaces = false }: { title: string; children: ReactNode; shufflePlaces?: boolean }) {
  const rail = useRef<HTMLDivElement>(null);
  const railId = useId();
  const seed = useDocumentSeed();
  const rendered = shufflePlaces ? orderPlaceRailChildren(children, `${seed}:${title}`) : children;
  useLayoutEffect(() => {
    if (rail.current) rail.current.scrollLeft = 0;
  }, [seed, title]);
  return <div className="event-rail-wrap">
    <SliderRailControls railId={railId} railRef={rail} label={title} className="event-rail-controls" />
    <div id={railId} className="event-rail" dir="rtl" ref={rail} data-horizontal-rail aria-label={title}>{rendered}</div>
  </div>;
}
