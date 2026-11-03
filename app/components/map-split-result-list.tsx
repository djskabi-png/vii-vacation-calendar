"use client";

import { useEffect, useMemo, useRef, type ReactNode } from "react";

export const MAP_SPLIT_RESULT_LIMIT = 18;

export function boundedMapResults<T>(
  items: T[],
  getId: (item: T) => string,
  activeId: string | null,
  limit = MAP_SPLIT_RESULT_LIMIT,
) {
  if (items.length <= limit) return items;
  const visible = items.slice(0, limit);
  if (!activeId || visible.some((item) => getId(item) === activeId)) return visible;
  const activeItem = items.find((item) => getId(item) === activeId);
  return activeItem ? [...visible.slice(0, Math.max(0, limit - 1)), activeItem] : visible;
}

export function MapSplitResultList<T>({
  items,
  getId,
  activeId,
  className,
  children,
}: {
  items: T[];
  getId: (item: T) => string;
  activeId: string | null;
  className: string;
  children: (item: T) => ReactNode;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const visibleItems = useMemo(
    () => boundedMapResults(items, getId, activeId),
    [items, getId, activeId],
  );

  useEffect(() => {
    if (!activeId || !listRef.current) return;
    const activeCard = Array.from(listRef.current.querySelectorAll<HTMLElement>("[data-map-place-id]"))
      .find((element) => element.dataset.mapPlaceId === activeId);
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    activeCard?.scrollIntoView({ block: "nearest", inline: "nearest", behavior });
  }, [activeId, visibleItems]);

  return <div ref={listRef} className={className} data-map-result-count={visibleItems.length}>
    {visibleItems.map(children)}
  </div>;
}
