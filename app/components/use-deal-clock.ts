"use client";

import { useSyncExternalStore } from "react";
import { dealClockKey } from "../lib/deal-clock";

type Clock = { key: string; now: Date };
let snapshot: Clock | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function refresh() {
  const now = new Date();
  const key = dealClockKey(now);
  if (snapshot?.key === key) return;
  snapshot = { key, now };
  listeners.forEach(listener => listener());
}

function tick() {
  refresh();
  timer = setTimeout(tick, 60_000 - Date.now() % 60_000 + 5);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    refresh();
    timer = setTimeout(tick, 60_000 - Date.now() % 60_000 + 5);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    }
  };
}

// Stable server snapshot avoids server/client timezone and hydration flashes.
export function useDealClock() {
  return useSyncExternalStore(subscribe, () => snapshot, () => null);
}
