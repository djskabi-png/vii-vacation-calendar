"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
    topic: params.get("topic")?.trim().slice(0, 120) || null,
  };
}

function replaceGalleryHash(tab: GalleryTab, index: number, topic?: string | null) {
  const url = new URL(window.location.href);
  const params = new URLSearchParams({ gallery: tab, photo: String(Math.max(0, index) + 1) });
  if (topic) params.set("topic", topic);
  url.hash = params.toString();
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
  const [galleryTopic, setGalleryTopic] = useState<string | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const syncFromHash = () => {
      const state = readGalleryHash();
      if (!state) {
        setGalleryOpen(false);
        return;
      }
      setGalleryTab(state.tab);
      setGalleryStart(state.index);
      setGalleryTopic(state.topic);
      setGalleryOpen(true);
    };
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  const openGallery = useCallback((tab: GalleryTab = "all", index = 0, topic: string | null = null) => {
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setGalleryTab(tab);
    setGalleryStart(index);
    setGalleryTopic(topic);
    setGalleryOpen(true);
    replaceGalleryHash(tab, index, topic);
  }, []);

  const closeGallery = useCallback(() => {
    setGalleryOpen(false);
    clearGalleryHash();
    window.setTimeout(() => {
      const fallback = document.querySelector<HTMLElement>("[data-gallery-trigger]");
      (returnFocus.current?.isConnected ? returnFocus.current : fallback)?.focus();
    }, 0);
  }, []);

  const updateGallerySelection = useCallback((tab: GalleryTab, index: number, topic?: string | null) => {
    if (galleryOpen) replaceGalleryHash(tab, index, topic);
  }, [galleryOpen]);

  return { galleryOpen, galleryStart, galleryTab, galleryTopic, openGallery, closeGallery, updateGallerySelection };
}
