"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type LockedPageStyles = {
  bodyPosition: string;
  bodyTop: string;
  bodyInsetInline: string;
  bodyWidth: string;
  bodyOverflow: string;
  htmlScrollBehavior: string;
};

export function useMapViewState() {
  const [mapOpen, setIsMapOpen] = useState(false);
  const scrollPosition = useRef(0);
  const lockedStyles = useRef<LockedPageStyles | null>(null);

  const lockPage = useCallback(() => {
    if (typeof window === "undefined" || lockedStyles.current) return;
    scrollPosition.current = window.scrollY;
    const body = document.body;
    lockedStyles.current = {
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyInsetInline: body.style.insetInline,
      bodyWidth: body.style.width,
      bodyOverflow: body.style.overflow,
      htmlScrollBehavior: document.documentElement.style.scrollBehavior,
    };
    body.style.position = "fixed";
    body.style.top = `-${scrollPosition.current}px`;
    body.style.insetInline = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";
    body.setAttribute("data-map-overlay-lock", "true");
  }, []);

  const unlockPage = useCallback(() => {
    if (typeof window === "undefined" || !lockedStyles.current) return;

    const styles = lockedStyles.current;
    lockedStyles.current = null;
    document.body.style.position = styles.bodyPosition;
    document.body.style.top = styles.bodyTop;
    document.body.style.insetInline = styles.bodyInsetInline;
    document.body.style.width = styles.bodyWidth;
    document.body.style.overflow = styles.bodyOverflow;
    document.body.removeAttribute("data-map-overlay-lock");
    document.documentElement.style.scrollBehavior = "auto";
    window.scrollTo(0, scrollPosition.current);
    window.requestAnimationFrame(() => {
      document.documentElement.style.scrollBehavior = styles.htmlScrollBehavior;
    });
  }, []);

  const openMap = useCallback(() => {
    if (typeof window !== "undefined") scrollPosition.current = window.scrollY;
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 820px)").matches && !lockedStyles.current) {
      lockPage();
    }
    setIsMapOpen(true);
    if (typeof window !== "undefined" && !lockedStyles.current) {
      window.requestAnimationFrame(() => window.scrollTo(0, scrollPosition.current));
    }
  }, [lockPage]);

  const closeMap = useCallback(() => {
    setIsMapOpen(false);
    if (typeof window !== "undefined" && lockedStyles.current) window.requestAnimationFrame(unlockPage);
    else if (typeof window !== "undefined") window.requestAnimationFrame(() => window.scrollTo(0, scrollPosition.current));
  }, [unlockPage]);

  const toggleMap = useCallback(() => {
    if (mapOpen) closeMap();
    else openMap();
  }, [closeMap, mapOpen, openMap]);

  const setMapOpen = useCallback((next: boolean | ((current: boolean) => boolean)) => {
    const resolved = typeof next === "function" ? next(mapOpen) : next;
    if (resolved) openMap();
    else closeMap();
  }, [closeMap, mapOpen, openMap]);

  useEffect(() => () => unlockPage(), [unlockPage]);

  useEffect(() => {
    if (!mapOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      // The place card owns the first Escape. The next closes the map.
      if (document.querySelector(".map-results-experience .map-selection-card")) return;
      closeMap();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mapOpen, closeMap]);

  useEffect(() => {
    if (!mapOpen) return;
    const desktop = window.matchMedia("(min-width: 821px)");
    const releaseMobileLock = (event: MediaQueryListEvent | MediaQueryList) => {
      if (event.matches) unlockPage();
      else lockPage();
    };

    releaseMobileLock(desktop);
    desktop.addEventListener("change", releaseMobileLock);
    return () => desktop.removeEventListener("change", releaseMobileLock);
  }, [mapOpen, unlockPage, lockPage]);

  return { mapOpen, openMap, closeMap, toggleMap, setMapOpen };
}
