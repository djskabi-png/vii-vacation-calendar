"use client";
import type { ReactNode } from "react";
import { HomeSliderControls } from "./home-slider-controls";
import { orderPlaceRailChildren } from "../lib/place-rail-children";
import { useDocumentSeed } from "./use-document-seed";

// Keep the established desktop grid. Mobile uses the same bounded controls
// Semantic rails keep their order. Static place rails opt into refresh rotation.
export function HomeMobileRail({ id, label, className, children, shufflePlaces = false }: {
  id: string; label: string; className: string; children: ReactNode; shufflePlaces?: boolean;
}) {
  const seed = useDocumentSeed();
  const rendered = shufflePlaces ? orderPlaceRailChildren(children, `${seed}:${id}`) : children;
  return <>
    <div className="home-mobile-rail-controls"><HomeSliderControls railId={id} label={label} /></div>
    <div id={id} className={`${className} home-mobile-rail`} data-horizontal-rail aria-label={label}>{rendered}</div>
  </>;
}
