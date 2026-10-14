"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useSiteLanguage } from "../i18n/locale-provider";

type RailState = { previous: boolean; next: boolean };

export function HomeSliderControls({
  railId,
  label,
  itemSelector = ":scope > *",
  disabled = false,
}: {
  railId: string;
  label: string;
  itemSelector?: string;
  disabled?: boolean;
}) {
  const { language } = useSiteLanguage();
  const [railState, setRailState] = useState<RailState>({ previous: false, next: false });

  const updateRailState = useCallback(() => {
    const rail = document.getElementById(railId);
    const items = rail?.querySelectorAll<HTMLElement>(itemSelector);
    if (disabled || !rail || !items?.length) {
      setRailState((current) => current.previous || current.next ? { previous: false, next: false } : current);
      return;
    }

    const bounds = rail.getBoundingClientRect();
    const first = items[0].getBoundingClientRect();
    const last = items[items.length - 1].getBoundingClientRect();
    const rtl = getComputedStyle(rail).direction === "rtl";
    const nextState = rtl
      ? { previous: first.right > bounds.right + 2, next: last.left < bounds.left - 2 }
      : { previous: first.left < bounds.left - 2, next: last.right > bounds.right + 2 };

    setRailState((current) => current.previous === nextState.previous && current.next === nextState.next ? current : nextState);
  }, [disabled, itemSelector, railId]);

  useEffect(() => {
    const rail = document.getElementById(railId);
    if (!rail) return;

    const frame = window.requestAnimationFrame(updateRailState);
    const resizeObserver = new ResizeObserver(updateRailState);
    const mutationObserver = new MutationObserver(updateRailState);
    resizeObserver.observe(rail);
    rail.querySelectorAll<HTMLElement>(itemSelector).forEach((item) => resizeObserver.observe(item));
    mutationObserver.observe(rail, { childList: true, subtree: false });
    rail.addEventListener("scroll", updateRailState, { passive: true });

    return () => {
      window.cancelAnimationFrame(frame);
      rail.removeEventListener("scroll", updateRailState);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [itemSelector, railId, updateRailState]);

  function move(direction: -1 | 1) {
    const allowed = direction === -1 ? railState.previous : railState.next;
    const rail = document.getElementById(railId);
    if (!allowed || !rail) return;
    const item = rail.querySelector<HTMLElement>(itemSelector);
    const style = getComputedStyle(rail);
    const gap = Number.parseFloat(style.columnGap || style.gap) || 0;
    const step = (item?.getBoundingClientRect().width || rail.clientWidth) + gap;
    rail.scrollBy({ left: direction * step * (style.direction === "rtl" ? -1 : 1), behavior: "smooth" });
  }

  const previous = { he: "הקודם", en: "Previous", ru: "Назад", fr: "Précédent" }[language];
  const next = { he: "הבא", en: "Next", ru: "Далее", fr: "Suivant" }[language];
  const PreviousIcon = language === "he" ? ChevronRight : ChevronLeft;
  const NextIcon = language === "he" ? ChevronLeft : ChevronRight;

  return <div className="home-slider__controls" role="group" aria-label={label} aria-controls={railId}>
    <button type="button" onClick={() => move(-1)} aria-label={`${previous}, ${label}`} title={previous} disabled={disabled || !railState.previous}><PreviousIcon aria-hidden="true" /></button>
    <button type="button" onClick={() => move(1)} aria-label={`${next}, ${label}`} title={next} disabled={disabled || !railState.next}><NextIcon aria-hidden="true" /></button>
  </div>;
}
