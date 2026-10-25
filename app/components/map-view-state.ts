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

const MAP_INTENT_KEY = "vii-map-view-intent-v1";
const MAP_INTENT_TTL_MS = 2 * 60_000;

function currentRouteKey() {
  return `${window.location.pathname}${window.location.search}`;
}

function rememberOpenIntent() {
  try {
    window.sessionStorage.setItem(MAP_INTENT_KEY, JSON.stringify({ route: currentRouteKey(), expiresAt: Date.now() + MAP_INTENT_TTL_MS }));
  } catch {
    // Session storage is an enhancement. The map remains usable without it.
  }
}

function clearOpenIntent() {
  try { window.sessionStorage.removeItem(MAP_INTENT_KEY); } catch { /* no-op */ }
}

function hasFreshOpenIntent() {
  try {
    const raw = window.sessionStorage.getItem(MAP_INTENT_KEY);
    if (!raw) return false;
    const intent = JSON.parse(raw) as { route?: string; expiresAt?: number };
    if (intent.route === currentRouteKey() && Number(intent.expiresAt) > Date.now()) return true;
    clearOpenIntent();
  } catch {
    clearOpenIntent();
  }
  return false;
}

function revealDesktopMap() {
  if (typeof window === "undefined" || !window.matchMedia("(min-width: 821px)").matches) return;

  const behavior: ScrollBehavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  window.requestAnimationFrame(() => {
    document.querySelector<HTMLElement>(".map-results-experience")?.scrollIntoView({ block: "start", behavior });
  });
}

export function useMapViewState() {
  const [mapOpen, setIsMapOpen] = useState(false);
  const [mapInteractive, setMapInteractive] = useState(false);
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
    if (typeof window !== "undefined") rememberOpenIntent();
    if (typeof window !== "undefined") scrollPosition.current = window.scrollY;
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 820px)").matches && !lockedStyles.current) {
      lockPage();
    }
    setIsMapOpen(true);
  }, [lockPage]);

  const closeMap = useCallback(() => {
    if (typeof window !== "undefined") clearOpenIntent();
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

  useEffect(() => {
    if (hasFreshOpenIntent()) {
      setIsMapOpen(true);
      if (window.matchMedia("(max-width: 820px)").matches) lockPage();
    }
    setMapInteractive(true);
    return () => unlockPage();
  }, [lockPage, unlockPage]);

  useEffect(() => {
    // The results shell is conditionally rendered. Reveal it only after React
    // has committed the open map, otherwise the first desktop click can leave
    // the map below the fold even though its toggle is already active.
    if (mapOpen) revealDesktopMap();
  }, [mapOpen]);

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

  return { mapOpen, mapInteractive, openMap, closeMap, toggleMap, setMapOpen };
}
