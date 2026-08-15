"use client";

import { useCallback, useEffect, useState } from "react";
import type { GalleryTab } from "./gallery-experience";

const allowedTabs = new Set<GalleryTab>(["all", "place", "units", "bedrooms", "guests", "videos"]);

function readGalleryHash() {
  if (typeof window === "undefined") return null;
  const value = window.location.hash.replace(/^#/, "");
  const params = new URLSearchParams(value);
  if (!params.has("gallery")) return null;
  const requestedTab = params.get("gallery") as GalleryTab | null;
  const requestedPhoto = Number(params.get("photo"));
  return {
    tab: requestedTab && allowedTabs.has(requestedTab) ? requestedTab : "all" as GalleryTab,
    index: Number.isInteger(requestedPhoto) && requestedPhoto > 0 ? requestedPhoto - 1 : 0,
  };
}

function replaceGalleryHash(tab: GalleryTab, index: number) {
  const url = new URL(window.location.href);
  url.hash = `gallery=${tab}&photo=${Math.max(0, index) + 1}`;
  window.history.replaceState(window.history.state, "", url);
}

function clearGalleryHash() {
  if (!readGalleryHash()) return;
  const url = new URL(window.location.href);
  url.hash = "";
  window.history.replaceState(window.history.state, "", url);
}

/**
 * A gallery state that can be shared with a fragment such as
 * #gallery=all&photo=2. Fragments are not separate crawlable documents,
 * so the detail page keeps one canonical URL for search engines.
 */
export function useGalleryDeepLink() {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryStart, setGalleryStart] = useState(0);
  const [galleryTab, setGalleryTab] = useState<GalleryTab>("all");

  useEffect(() => {
    const syncFromHash = () => {
      const state = readGalleryHash();
      if (!state) {
        setGalleryOpen(false);
        return;
      }
      setGalleryTab(state.tab);
      setGalleryStart(state.index);
      setGalleryOpen(true);
    };
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  const openGallery = useCallback((tab: GalleryTab = "all", index = 0) => {
    setGalleryTab(tab);
    setGalleryStart(index);
    setGalleryOpen(true);
    replaceGalleryHash(tab, index);
  }, []);

  const closeGallery = useCallback(() => {
    setGalleryOpen(false);
    clearGalleryHash();
  }, []);

  const updateGallerySelection = useCallback((tab: GalleryTab, index: number) => {
    if (galleryOpen) replaceGalleryHash(tab, index);
  }, [galleryOpen]);

  return { galleryOpen, galleryStart, galleryTab, openGallery, closeGallery, updateGallerySelection };
}
