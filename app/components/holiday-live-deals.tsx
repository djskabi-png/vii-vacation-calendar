"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { HomeHoliday } from "../lib/vii-home-holidays.ts";
import type { HomeDeal } from "../lib/vii-home-deals.ts";
import { holidaySlug } from "../lib/holiday-world.ts";
import { dealAvailability, dealProperty } from "./home-live-deals.tsx";
import { PropertyCard } from "./property-card.tsx";
import { HomeSliderControls } from "./home-slider-controls.tsx";

type DealResponse = { holiday: HomeHoliday; deals: HomeDeal[] };

export function HolidayLiveDeals({ slug, searchHref }: { slug: string; searchHref: string }) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [deals, setDeals] = useState<HomeDeal[]>([]);
  const [holidayId, setHolidayId] = useState<number | null>(null);
  const [retry, setRetry] = useState(0);
  const rail = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    setState("loading");
    setDeals([]);
    fetch("/api/vii/home-holidays?all=1", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("holidays_unavailable");
        return response.json() as Promise<{ holidays: HomeHoliday[] }>;
      })
      .then(async ({ holidays }) => {
        const holiday = holidays.find((item) => holidaySlug(item.name, item.id) === slug);
        if (!holiday) { setHolidayId(null); setState("ready"); return; }
        setHolidayId(holiday.id);
        const response = await fetch(`/api/vii/home-holiday-deals?id=${holiday.id}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("deals_unavailable");
        return response.json() as Promise<DealResponse>;
      })
      .then((result) => {
        if (!result) return;
        setDeals(Array.isArray(result.deals) ? result.deals : []);
        setState("ready");
      })
      .catch((error) => { if (error?.name !== "AbortError") setState("error"); });
    return () => controller.abort();
  }, [retry, slug]);

  return <section className="holiday-deals section" aria-labelledby="holiday-live-title">
    <div className="shell">
      <div className="section-head holiday-section-head"><div><span className="eyebrow">נבדק מול מערכת הזמינות</span><h2 id="holiday-live-title">מקומות פנויים לחג</h2><p>התוצאות כאן מוצגות רק לאחר שהמערכת אישרה זמינות ומחיר לתאריכים.</p></div><div><Link href={searchHref}>לכל תוצאות החג</Link><HomeSliderControls railId="holiday-live-rail" label="מקומות פנויים לחג" itemSelector=".holiday-deals__item" disabled={state !== "ready" || !deals.length} /></div></div>
      <div className="holiday-deals__surface" aria-live="polite" aria-busy={state === "loading"}>
        {state === "loading" ? <div className="holiday-deals__loading" role="status"><span className="holiday-deals__spinner" aria-hidden="true" /><strong>בודקים זמינות ומחירים לתאריכי החג</strong><small>התוצאות יופיעו כאן ברגע שהבדיקה תסתיים</small></div> : null}
        {state === "error" ? <div className="holiday-deals__message" role="alert"><strong>לא הצלחנו לבדוק זמינות כרגע</strong><button type="button" onClick={() => setRetry((value) => value + 1)}>לנסות שוב</button></div> : null}
        {state === "ready" && !deals.length ? <div className="holiday-deals__message"><strong>אין כרגע מקומות מאומתים לחלון הזה</strong><p>אפשר לפתוח את החיפוש המלא ולבחור חלון אחר בתוך החג.</p><Link href={searchHref}>פתיחת החיפוש</Link></div> : null}
        {state === "ready" && deals.length ? <div id="holiday-live-rail" className="holiday-deals__rail" ref={rail} data-horizontal-rail>{deals.map((deal) => {
          const href = `/business?${new URLSearchParams({ id: `vacation-${deal.siteID}`, from: deal.from, till: deal.till, guests: String(deal.priceGuests || 2), source: "home-holidays", period: String(holidayId || "") }).toString()}`;
          return <div className="holiday-deals__item" key={`${deal.siteID}-${deal.from}`}><PropertyCard property={dealProperty(deal)} selectedStay={{ from: deal.from, till: deal.till, guests: deal.priceGuests }} liveAvailabilityState={{ status: "ready", quote: dealAvailability(deal) }} detailHref={href} /></div>;
        })}</div> : null}
      </div>
    </div>
  </section>;
}
