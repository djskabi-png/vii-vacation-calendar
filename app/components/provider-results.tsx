"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { DiscoveryItem } from "../data/world-data";
import { providerCategories, providerCategoryHref, type ProviderCategoryId } from "../data/provider-categories";
import { DiscoveryCard } from "./discovery-card";
import { ModernSelect } from "./modern-select";
import { ProgressiveResults } from "./progressive-results";

export function ProviderResults({ items, category = "all" }: { items: DiscoveryItem[]; category?: ProviderCategoryId }) {
  const searchParams = useSearchParams();
  const searchQuery = searchParams.toString();
  const categoryNavRef = useRef<HTMLElement>(null);
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [region, setRegion] = useState(searchParams.get("region") || "כל הארץ");
  const regions = useMemo(() => ["כל הארץ", ...Array.from(new Set(items.flatMap((item) => item.serviceAreas || [item.area])))], [items]);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("he");
    return items.filter((item) => {
      const text = `${item.name} ${(item.searchTerms || []).join(" ")} ${item.area} ${item.description} ${item.features.join(" ")}`;
      const matchesQuery = !normalized || text.toLocaleLowerCase("he").includes(normalized);
      const matchesRegion = region === "כל הארץ" || (item.serviceAreas || [item.area]).includes(region);
      return matchesQuery && matchesRegion;
    });
  }, [items, query, region]);

  function updateUrl(updates: Record<string, string>) {
    const params = new URLSearchParams(window.location.search);
    Object.entries(updates).forEach(([key, value]) => value && value !== "all" && value !== "כל הארץ" ? params.set(key, value) : params.delete(key));
    window.history.pushState(null, "", `${window.location.pathname}${params.size ? `?${params}` : ""}`);
  }

  function resetFilters() {
    setQuery("");
    setRegion("כל הארץ");
    updateUrl({ q: "", region: "" });
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(searchQuery);
      setQuery(params.get("q") || "");
      setRegion(params.get("region") || "כל הארץ");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    categoryNavRef.current?.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [category]);

  return <div className="provider-results">
    <div className="provider-toolbar">
      <label className="provider-search"><span>חיפוש ספק</span><input value={query} onChange={(event) => { const value = event.target.value; setQuery(value); updateUrl({ q: value.trim() }); }} placeholder="שם, שירות או תחום" /></label>
      <ModernSelect label="אזור שירות" value={region} onChange={(value) => { setRegion(value); updateUrl({ region: value }); }} options={regions.map((option) => ({ value: option, label: option }))} />
      <div className="provider-filter-options">
        <div className="provider-categories-shell">
          <nav ref={categoryNavRef} className="provider-categories" aria-label="עמודי ספקים לפי תחום" data-horizontal-rail>
            {providerCategories.map((entry) => <Link key={entry.id} href={providerCategoryHref(entry)} aria-current={category === entry.id ? "page" : undefined}>{entry.label}</Link>)}
          </nav>
          <span className="provider-categories__scroll-cue" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M14.5 5.5 8 12l6.5 6.5" /></svg></span>
        </div>
        {(query || region !== "כל הארץ") ? <button type="button" className="provider-reset" onClick={resetFilters}>ניקוי סינונים</button> : null}
      </div>
    </div>
    <p className="provider-results-count" aria-live="polite">{filtered.length === 1 ? "ספק אחד מתאים" : `${filtered.length} ספקים מתאימים`}</p>
    {filtered.length ? <ProgressiveResults className="discovery-grid" kind="providers" resetKey={`${category}|${query}|${region}`}>{filtered.map((item) => <DiscoveryCard key={item.id} item={item} />)}</ProgressiveResults> : <div className="provider-empty"><h3>לא מצאנו התאמה מדויקת</h3><p>אפשר לנקות את החיפוש או לבחור תחום אחר.</p></div>}
  </div>;
}
