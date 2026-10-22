"use client";
import { useCallback, useEffect, useState } from "react";
import { parseStayCalendar, type StayCalendar } from "../lib/vii-stay-calendar.ts";

export function useViiStayCalendar(siteID: number | null, open: boolean, from: string) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; calendar: StayCalendar | null; status: "ready" | "error" } | null>(null);
  const date = new Date(`${from}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 365);
  const till = Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
  const key = `${siteID}|${from}|${till}|${attempt}`;
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  useEffect(() => {
    if (!siteID || !open || !from || !till) return;
    const controller = new AbortController();
    const deadline = window.setTimeout(() => controller.abort(new DOMException("Stay calendar timed out", "TimeoutError")), 8_000);
    setResult(null);
    fetch(`/api/vii/stay-calendar?${new URLSearchParams({ siteID: String(siteID), from, till })}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw Error("calendar_unavailable"); return parseStayCalendar(await response.json(), siteID, from, till); })
      .then((calendar) => { if (!controller.signal.aborted) setResult({ key, calendar, status: "ready" }); })
      .catch(() => { if (!controller.signal.aborted) setResult({ key, calendar: null, status: "error" }); });
    return () => { window.clearTimeout(deadline); controller.abort(); };
  }, [siteID, open, from, till, key]);
  return { calendar: result?.key === key ? result.calendar : null, status: !siteID || !open ? "idle" as const : result?.key === key ? result.status : "loading" as const, retry };
}
