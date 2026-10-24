"use client";

import { useCallback, useEffect, useState, type RefObject } from "react";
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
  const [state, setState] = useState<SliderRailState>({ previous: false, next: false });
  const resolveRail = useCallback(() => railRef?.current || (railId ? document.getElementById(railId) : null), [railId, railRef]);

  const update = useCallback(() => {
    const rail = resolveRail();
    const items = rail?.querySelectorAll<HTMLElement>(itemSelector);
    if (disabled || !rail || !items?.length) {
      setState((current) => current.previous || current.next ? { previous: false, next: false } : current);
      return;
    }

    const bounds = rail.getBoundingClientRect();
    const first = items[0].getBoundingClientRect();
    const last = items[items.length - 1].getBoundingClientRect();
    const rtl = getComputedStyle(rail).direction === "rtl";
    const nextState = rtl
      ? { previous: first.right > bounds.right + 2, next: last.left < bounds.left - 2 }
      : { previous: first.left < bounds.left - 2, next: last.right > bounds.right + 2 };

    setState((current) => current.previous === nextState.previous && current.next === nextState.next ? current : nextState);
  }, [disabled, itemSelector, resolveRail]);

  useEffect(() => {
    const rail = resolveRail();
    if (!rail) return;

    const resizeObserver = new ResizeObserver(update);
    const observeItems = () => rail.querySelectorAll<HTMLElement>(itemSelector).forEach((item) => resizeObserver.observe(item));
    const mutationObserver = new MutationObserver(() => {
      observeItems();
      update();
    });
    const frame = window.requestAnimationFrame(update);
    resizeObserver.observe(rail);
    observeItems();
    mutationObserver.observe(rail, { childList: true, subtree: false });
    rail.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);

    return () => {
      window.cancelAnimationFrame(frame);
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
  const state = useSliderRailBoundaries({ railId, railRef, itemSelector, disabled });
  useEffect(() => {
    const rail = railRef?.current || (railId ? document.getElementById(railId) : null);
    if (!rail || disabled) return;
    const frame = window.requestAnimationFrame(() => {
      rail.scrollTo({ left: 0, behavior: "instant" });
      state.update();
    });
    return () => window.cancelAnimationFrame(frame);
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
    <button type="button" onClick={() => state.move(-1)} aria-label={`${previous}, ${label}`} title={previous} disabled={disabled || !state.previous}><PreviousIcon aria-hidden="true" /></button>
    <button type="button" onClick={() => state.move(1)} aria-label={`${next}, ${label}`} title={next} disabled={disabled || !state.next}><NextIcon aria-hidden="true" /></button>
  </div>;
}
