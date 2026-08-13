"use client";

import { useCallback, useEffect, useState } from "react";
import { useSiteLanguage, type SiteLanguage } from "../i18n/locale-provider";

export type ResultsViewMode = "grid" | "list";

const copy: Record<SiteLanguage, { label: string; grid: string; list: string }> = {
  he: { label: "בחירת תצוגת תוצאות", grid: "כרטיסים", list: "רשימה" },
  en: { label: "Choose results view", grid: "Grid", list: "List" },
  ru: { label: "Выбор вида результатов", grid: "Плитка", list: "Список" },
  fr: { label: "Choisir l’affichage des résultats", grid: "Grille", list: "Liste" },
};

function GridIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>;
}

function ListIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h12M9 12h12M9 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></svg>;
}

export function useResultsViewMode(world: string) {
  const [viewMode, setViewModeState] = useState<ResultsViewMode>("grid");

  useEffect(() => {
    const mobileQuery = window.matchMedia("(max-width: 820px)");

    const syncViewMode = () => {
      const url = new URL(window.location.href);
      const requested = url.searchParams.get("view");
      if (mobileQuery.matches) {
        setViewModeState("grid");
        if (requested === "list") {
          url.searchParams.delete("view");
          window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
        }
        return;
      }
      setViewModeState(requested === "list" ? "list" : "grid");
    };

    syncViewMode();
    mobileQuery.addEventListener("change", syncViewMode);
    return () => mobileQuery.removeEventListener("change", syncViewMode);
  }, [world]);

  const setViewMode = useCallback((next: ResultsViewMode) => {
    setViewModeState(next);
    const url = new URL(window.location.href);
    if (next === "list") url.searchParams.set("view", "list");
    else url.searchParams.delete("view");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, [world]);

  return { viewMode, setViewMode };
}

export function ResultsViewToggle({ value, onChange }: { value: ResultsViewMode; onChange: (next: ResultsViewMode) => void }) {
  const { language } = useSiteLanguage();
  const labels = copy[language];
  return <div className="results-view-toggle" role="group" aria-label={labels.label}>
    <button type="button" className={value === "grid" ? "active" : ""} aria-pressed={value === "grid"} aria-label={labels.grid} title={labels.grid} onClick={() => onChange("grid")}><GridIcon /><span>{labels.grid}</span></button>
    <button type="button" className={value === "list" ? "active" : ""} aria-pressed={value === "list"} aria-label={labels.list} title={labels.list} onClick={() => onChange("list")}><ListIcon /><span>{labels.list}</span></button>
  </div>;
}
