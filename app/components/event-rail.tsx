"use client";

import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from "react";
import { SliderRailControls } from "./slider-rail-controls";
import { orderPlaceRailChildren } from "../lib/place-rail-children";
import { useDocumentSeed } from "./use-document-seed";
import { useSiteLanguage } from "../i18n/locale-provider";

export function EventRail({ title, children, shufflePlaces = false, warmAheadImages = false }: { title: string; children: ReactNode; shufflePlaces?: boolean; warmAheadImages?: boolean }) {
  const rail = useRef<HTMLDivElement>(null);
  const warmedImages = useRef(new Set<string>());
  const imagePreloaders = useRef<HTMLImageElement[]>([]);
  const railId = useId();
  const seed = useDocumentSeed();
  const { language } = useSiteLanguage();
  const rendered = shufflePlaces ? orderPlaceRailChildren(children, `${seed}:${title}`) : children;
  useLayoutEffect(() => {
    if (rail.current) rail.current.scrollLeft = 0;
  }, [seed, title]);
  useEffect(() => {
    const element = rail.current;
    if (!element || !warmAheadImages) return;
    let frame = 0;
    const warmVisibleRange = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const railBounds = element.getBoundingClientRect();
        const preloadDistance = element.clientWidth;
        element.querySelectorAll<HTMLImageElement>("img").forEach((image) => {
          const card = image.closest<HTMLElement>(".event-rail-card");
          if (!card) return;
          const cardBounds = card.getBoundingClientRect();
          const nearRail = cardBounds.right >= railBounds.left - preloadDistance
            && cardBounds.left <= railBounds.right + preloadDistance;
          const source = image.currentSrc || image.src;
          if (!nearRail || !source || warmedImages.current.has(source)) return;
          warmedImages.current.add(source);
          const preloader = new Image();
          preloader.decoding = "async";
          preloader.src = source;
          imagePreloaders.current.push(preloader);
        });
      });
    };
    warmVisibleRange();
    element.addEventListener("scroll", warmVisibleRange, { passive: true });
    window.addEventListener("resize", warmVisibleRange);
    return () => {
      cancelAnimationFrame(frame);
      element.removeEventListener("scroll", warmVisibleRange);
      window.removeEventListener("resize", warmVisibleRange);
      imagePreloaders.current = [];
    };
  }, [seed, title, warmAheadImages]);
  return <div className="event-rail-wrap">
    <SliderRailControls railId={railId} railRef={rail} label={title} className="event-rail-controls" />
    <div id={railId} className="event-rail" dir={language === "he" ? "rtl" : "ltr"} ref={rail} data-horizontal-rail aria-label={title}>{rendered}</div>
  </div>;
}
