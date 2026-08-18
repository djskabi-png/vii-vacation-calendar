"use client";

import { Children, type ReactNode, useMemo, useState } from "react";
import { useSiteLanguage, type SiteLanguage } from "../i18n/locale-provider";

type ResultKind = "places" | "trails" | "providers";

const copy: Record<SiteLanguage, Record<ResultKind, { more: (count: number) => string; progress: (visible: number, total: number) => string }>> = {
  he: {
    places: { more: (count) => `הצגת ${count} מקומות נוספים`, progress: (visible, total) => `${visible} מתוך ${total} מקומות` },
    trails: { more: (count) => `הצגת ${count} מסלולים נוספים`, progress: (visible, total) => `${visible} מתוך ${total} מסלולים` },
    providers: { more: (count) => `הצגת ${count} ספקים נוספים`, progress: (visible, total) => `${visible} מתוך ${total} ספקים` },
  },
  en: {
    places: { more: (count) => `Show ${count} more places`, progress: (visible, total) => `${visible} of ${total} places` },
    trails: { more: (count) => `Show ${count} more trails`, progress: (visible, total) => `${visible} of ${total} trails` },
    providers: { more: (count) => `Show ${count} more providers`, progress: (visible, total) => `${visible} of ${total} providers` },
  },
  ru: {
    places: { more: (count) => `Показать ещё ${count}`, progress: (visible, total) => `${visible} из ${total} мест` },
    trails: { more: (count) => `Показать ещё ${count}`, progress: (visible, total) => `${visible} из ${total} маршрутов` },
    providers: { more: (count) => `Показать ещё ${count}`, progress: (visible, total) => `${visible} из ${total} поставщиков` },
  },
  fr: {
    places: { more: (count) => `Afficher ${count} lieux de plus`, progress: (visible, total) => `${visible} lieux sur ${total}` },
    trails: { more: (count) => `Afficher ${count} parcours de plus`, progress: (visible, total) => `${visible} parcours sur ${total}` },
    providers: { more: (count) => `Afficher ${count} prestataires de plus`, progress: (visible, total) => `${visible} prestataires sur ${total}` },
  },
};

type ProgressiveResultsProps = {
  children: ReactNode;
  className: string;
  kind?: ResultKind;
  initialCount?: number;
  increment?: number;
  resetKey?: string;
};

export function ProgressiveResults(props: ProgressiveResultsProps) {
  const resetKey = props.resetKey ?? "";
  const initialCount = props.initialCount ?? 9;
  return <ProgressiveResultsWindow key={`${resetKey}\u0000${initialCount}`} {...props} />;
}

function ProgressiveResultsWindow({
  children,
  className,
  kind = "places",
  initialCount = 9,
  increment = 9,
}: ProgressiveResultsProps) {
  const { language } = useSiteLanguage();
  const items = useMemo(() => Children.toArray(children), [children]);
  const [visibleCount, setVisibleCount] = useState(initialCount);

  const visibleItems = items.slice(0, visibleCount);
  const remaining = Math.max(0, items.length - visibleItems.length);
  const nextCount = Math.min(increment, remaining);
  const labels = copy[language][kind];

  return <>
    <div className={className}>{visibleItems}</div>
    {remaining > 0 ? <div className="progressive-results">
      <button type="button" onClick={() => setVisibleCount((current) => Math.min(items.length, current + increment))}>
        <span>{labels.more(nextCount)}</span>
        <small aria-live="polite">{labels.progress(visibleItems.length, items.length)}</small>
      </button>
    </div> : null}
  </>;
}
