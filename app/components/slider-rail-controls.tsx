"use client";

import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useSiteLanguage } from "../i18n/locale-provider";

export type SliderRailState = { previous: boolean; next: boolean };

type SliderRailTarget = {
  railId?: string;
  railRef?: RefObject<HTMLElement | null>;
  itemSelector?: string;
  disabled?: boolean;
};

export function boundedSliderIndex(current: number, direction: -1 | 1, length: number) {
  return Math.max(0, Math.min(Math.max(0, length - 1), current + direction));
}

export function useSliderRailBoundaries({ railId, railRef, itemSelector = ":scope > *", disabled = false }: SliderRailTarget) {
  const [state, setState] = useState<SliderRailState>({ previous: false, next: true });
  const boundaryFrame = useRef<number | null>(null);
  const observing = useRef(false);
  const resolveRail = useCallback(() => railRef?.current || (railId ? document.getElementById(railId) : null), [railId, railRef]);

  const measure = useCallback(() => {
    const rail = resolveRail();
    const item = rail?.querySelector<HTMLElement>(itemSelector);
    if (disabled || !rail || !item) {
      setState((current) => current.previous || current.next ? { previous: false, next: false } : current);
      return;
    }

    const maxScroll = Math.max(0, rail.scrollWidth - rail.clientWidth);
    const progress = Math.min(maxScroll, Math.abs(rail.scrollLeft));
    const nextState = { previous: progress > 2, next: progress < maxScroll - 2 };

    setState((current) => current.previous === nextState.previous && current.next === nextState.next ? current : nextState);
  }, [disabled, itemSelector, resolveRail]);

  // Resize, mutation and scroll notifications can arrive together while cards
  // stream in. Read geometry once per frame, rather than flushing layout for
  // each notification. The item observers remain responsible for size changes.
  const update = useCallback(() => {
    if (!observing.current || boundaryFrame.current !== null) return;
    boundaryFrame.current = window.requestAnimationFrame(() => {
      boundaryFrame.current = null;
      if (observing.current) measure();
    });
  }, [measure]);

  useLayoutEffect(() => {
    const rail = resolveRail();
    if (!rail) return;
    observing.current = true;

    // Streaming sections can appear after the browser has already restored a
    // stale logical scroll position. Normalize the new rail before observers
    // publish button boundaries, so RTL controls never flash as if the user
    // were already at the opposite end.
    if (rail.scrollLeft !== 0) rail.scrollLeft = 0;
    update();
    const resizeObserver = new ResizeObserver(update);
    const observeItems = () => rail.querySelectorAll<HTMLElement>(itemSelector).forEach((item) => resizeObserver.observe(item));
    const mutationObserver = new MutationObserver(() => {
      observeItems();
      update();
    });
    resizeObserver.observe(rail);
    observeItems();
    mutationObserver.observe(rail, { childList: true, subtree: false });
    rail.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);

    return () => {
      observing.current = false;
      if (boundaryFrame.current !== null) window.cancelAnimationFrame(boundaryFrame.current);
      boundaryFrame.current = null;
      rail.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [itemSelector, resolveRail, update]);

  const move = useCallback((direction: -1 | 1) => {
    const allowed = direction === -1 ? state.previous : state.next;
    const rail = resolveRail();
    if (!allowed || !rail) return;
    const item = rail.querySelector<HTMLElement>(itemSelector);
    const style = getComputedStyle(rail);
    const gap = Number.parseFloat(style.columnGap || style.gap) || 0;
    const step = (item?.getBoundingClientRect().width || rail.clientWidth) + gap;
    rail.scrollBy({ left: direction * step * (style.direction === "rtl" ? -1 : 1), behavior: "smooth" });
  }, [itemSelector, resolveRail, state.next, state.previous]);

  return { ...state, move, update };
}

export function SliderRailControls({
  railId,
  railRef,
  label,
  itemSelector = ":scope > *",
  disabled = false,
  className,
}: SliderRailTarget & { label: string; className: string }) {
  const { language } = useSiteLanguage();
  const controlInteracted = useRef(false);
  const state = useSliderRailBoundaries({ railId, railRef, itemSelector, disabled });
  useLayoutEffect(() => {
    const resolveRail = () => railRef?.current || (railId ? document.getElementById(railId) : null);
    if (!resolveRail() || disabled) return;
    let settleFrame = 0;
    let settleTimer = 0;
    let settleInterval = 0;
    controlInteracted.current = false;
    let userInteracted = false;
    let normalizedRail: HTMLElement | null = null;
    const normalize = () => {
      if (userInteracted || controlInteracted.current) return;
      const rail = resolveRail();
      if (!rail) return;
      // Polling still detects a streamed replacement or restored RTL offset,
      // but an unchanged rail must not repeatedly write scroll position and
      // force another full boundary/layout measurement every 100ms.
      if (rail === normalizedRail && rail.scrollLeft === 0) return;
      normalizedRail = rail;
      if (rail.scrollLeft !== 0) rail.scrollLeft = 0;
      state.update();
    };
    const preserveUserPosition = (event: Event) => {
      const rail = resolveRail();
      if (rail && event.target instanceof Node && rail.contains(event.target)) userInteracted = true;
    };
    const frame = window.requestAnimationFrame(() => {
      normalize();
      settleFrame = window.requestAnimationFrame(normalize);
      settleTimer = window.setTimeout(() => {
        window.clearInterval(settleInterval);
        normalize();
      }, 3_000);
      // React streaming can replace a server-rendered rail after the controls
      // have mounted. Keep normalizing only during the initial settle window,
      // and stop immediately if the visitor starts interacting with the rail.
      settleInterval = window.setInterval(normalize, 100);
    });
    document.addEventListener("pointerdown", preserveUserPosition, true);
    document.addEventListener("touchstart", preserveUserPosition, true);
    document.addEventListener("wheel", preserveUserPosition, true);
    document.addEventListener("keydown", preserveUserPosition, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.cancelAnimationFrame(settleFrame);
      window.clearTimeout(settleTimer);
      window.clearInterval(settleInterval);
      document.removeEventListener("pointerdown", preserveUserPosition, true);
      document.removeEventListener("touchstart", preserveUserPosition, true);
      document.removeEventListener("wheel", preserveUserPosition, true);
      document.removeEventListener("keydown", preserveUserPosition, true);
    };
  }, [disabled, language, railId, railRef, state.update]);
  const previous = { he: "הקודם", en: "Previous", ru: "Назад", fr: "Précédent" }[language];
  const next = { he: "הבא", en: "Next", ru: "Далее", fr: "Suivant" }[language];
  const PreviousIcon = language === "he" ? ChevronRight : ChevronLeft;
  const NextIcon = language === "he" ? ChevronLeft : ChevronRight;

  return <div
    className={className}
    role="group"
    aria-label={label}
    aria-controls={disabled ? undefined : railId}
    data-slider-controls
    style={{ direction: language === "he" ? "rtl" : "ltr" }}
  >
    <button type="button" onClick={() => { controlInteracted.current = true; state.move(-1); }} aria-label={`${previous}, ${label}`} title={previous} disabled={disabled || !state.previous}><PreviousIcon aria-hidden="true" /></button>
    <button type="button" onClick={() => { controlInteracted.current = true; state.move(1); }} aria-label={`${next}, ${label}`} title={next} disabled={disabled || !state.next}><NextIcon aria-hidden="true" /></button>
  </div>;
}
