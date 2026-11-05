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
    if (!activeCard) return;
    const list = listRef.current;
    const viewportTop = list.getBoundingClientRect().top + list.clientTop;
    const viewportBottom = viewportTop + list.clientHeight;
    const card = activeCard.getBoundingClientRect();
    const offset = card.top < viewportTop ? card.top - viewportTop
      : card.bottom > viewportBottom ? card.bottom - viewportBottom : 0;
    if (!offset) return;
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    // Scroll this pane only. scrollIntoView also scrolls the document and can
    // push the adjacent map's selected-place card and close button offscreen.
    list.scrollTo({ top: list.scrollTop + offset, behavior });
  }, [activeId, visibleItems]);

  return <div ref={listRef} className={className} data-map-result-count={visibleItems.length}>
    {visibleItems.map(children)}
  </div>;
}
