"use client";

import { Children, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useSiteLanguage, type SiteLanguage } from "../i18n/locale-provider";

type ResultKind = "places" | "trails" | "providers";

const copy: Record<SiteLanguage, Record<ResultKind, { loading: string; more: (count: number) => string; progress: (visible: number, total: number) => string }>> = {
  he: {
    places: { loading: "טוענים עוד מקומות...", more: (count) => `הצגת ${count} מקומות נוספים`, progress: (visible, total) => `${visible} מתוך ${total} מקומות` },
    trails: { loading: "טוענים עוד מסלולים...", more: (count) => `הצגת ${count} מסלולים נוספים`, progress: (visible, total) => `${visible} מתוך ${total} מסלולים` },
    providers: { loading: "טוענים עוד ספקים...", more: (count) => `הצגת ${count} ספקים נוספים`, progress: (visible, total) => `${visible} מתוך ${total} ספקים` },
  },
  en: {
    places: { loading: "Loading more places...", more: (count) => `Show ${count} more places`, progress: (visible, total) => `${visible} of ${total} places` },
    trails: { loading: "Loading more trails...", more: (count) => `Show ${count} more trails`, progress: (visible, total) => `${visible} of ${total} trails` },
    providers: { loading: "Loading more providers...", more: (count) => `Show ${count} more providers`, progress: (visible, total) => `${visible} of ${total} providers` },
  },
  ru: {
    places: { loading: "Загружаем ещё места...", more: (count) => `Показать ещё ${count}`, progress: (visible, total) => `${visible} из ${total} мест` },
    trails: { loading: "Загружаем ещё маршруты...", more: (count) => `Показать ещё ${count}`, progress: (visible, total) => `${visible} из ${total} маршрутов` },
    providers: { loading: "Загружаем ещё поставщиков...", more: (count) => `Показать ещё ${count}`, progress: (visible, total) => `${visible} из ${total} поставщиков` },
  },
  fr: {
    places: { loading: "Chargement d'autres lieux...", more: (count) => `Afficher ${count} lieux de plus`, progress: (visible, total) => `${visible} lieux sur ${total}` },
    trails: { loading: "Chargement d'autres parcours...", more: (count) => `Afficher ${count} parcours de plus`, progress: (visible, total) => `${visible} parcours sur ${total}` },
    providers: { loading: "Chargement d'autres prestataires...", more: (count) => `Afficher ${count} prestataires de plus`, progress: (visible, total) => `${visible} prestataires sur ${total}` },
  },
};

type ProgressiveResultsProps = {
  children: ReactNode;
  className: string;
  featuredItem?: ReactNode;
  featuredAfter?: number;
  kind?: ResultKind;
  initialCount?: number;
  increment?: number;
  resetKey?: string;
  totalCount?: number;
  visibleCount?: number;
  onShowMore?: () => void;
  autoLoad?: boolean;
};

export function ProgressiveResults(props: ProgressiveResultsProps) {
  const resetKey = props.resetKey ?? "";
  const initialCount = props.initialCount ?? 9;
  return <ProgressiveResultsWindow key={`${resetKey}\u0000${initialCount}`} {...props} />;
}

function ProgressiveResultsWindow({
  children,
  className,
  featuredItem,
  featuredAfter = 2,
  kind = "places",
  initialCount = 9,
  increment = 9,
  totalCount,
  visibleCount: controlledVisibleCount,
  onShowMore,
  autoLoad = false,
}: ProgressiveResultsProps) {
  const { language } = useSiteLanguage();
  const items = useMemo(() => Children.toArray(children), [children]);
  const [visibleCount, setVisibleCount] = useState(initialCount);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  const controlled = typeof totalCount === "number" && typeof controlledVisibleCount === "number" && Boolean(onShowMore);
  const visibleItems = controlled ? items : items.slice(0, visibleCount);
  const effectiveVisibleCount = controlled ? controlledVisibleCount : visibleItems.length;
  const effectiveTotalCount = controlled ? totalCount : items.length;
  const uncontrolledRemaining = items.length - visibleItems.length;
  const remaining = Math.max(0, controlled ? effectiveTotalCount - effectiveVisibleCount : uncontrolledRemaining);
  const nextCount = Math.min(increment, remaining);
  const labels = copy[language][kind];

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!autoLoad || !sentinel || remaining <= 0) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting || loadingRef.current) return;
      loadingRef.current = true;
      if (controlled) onShowMore?.(); else setVisibleCount((current) => Math.min(items.length, current + increment));
      window.setTimeout(() => { loadingRef.current = false; }, 180);
    }, { rootMargin: "500px 0px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [autoLoad, controlled, increment, items.length, onShowMore, remaining]);

  return <>
    <div className={className}>
      {featuredItem ? <>{visibleItems.slice(0, featuredAfter)}{featuredItem}{visibleItems.slice(featuredAfter)}</> : visibleItems}
    </div>
    {remaining > 0 ? <div className="progressive-results" ref={sentinelRef} aria-busy={autoLoad || undefined}>
      <button type="button" onClick={() => controlled ? onShowMore?.() : setVisibleCount((current) => Math.min(items.length, current + increment))}>
        <span>{autoLoad ? labels.loading : labels.more(nextCount)}</span>
        <small aria-live="polite">{labels.progress(effectiveVisibleCount, effectiveTotalCount)}</small>
      </button>
    </div> : null}
  </>;
}
