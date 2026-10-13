"use client";

import { usePathname, useSearchParams } from "next/navigation";
import type { SearchMode } from "../data/search-taxonomy";
import { spaSearchDescription, spaSearchStateFromSegments, spaSearchTitle } from "../data/spa-search-landings";
import { spaLandings } from "../data/spa-landings";
import { useSiteLanguage } from "../i18n/locale-provider";

export function SemanticWorldHeading({ mode, title, description }: { mode?: SearchMode; title: string; description: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { language } = useSiteLanguage();
  let liveTitle = title;
  let liveDescription = description;

  if (mode === "spa") {
    const parts = pathname.split("/").filter(Boolean);
    const spaIndex = parts.indexOf("spas");
    const segments = spaIndex >= 0 && parts[spaIndex + 1] === "search" ? parts.slice(spaIndex + 2) : undefined;
    const pathState = spaSearchStateFromSegments(segments);
    const queryFeatures = (searchParams.get("features") || "")
      .split(",")
      .map((id) => spaLandings.find((entry) => entry.id === id))
      .filter((entry): entry is (typeof spaLandings)[number] => Boolean(entry));
    const state = pathState
      ? {
          ...pathState,
          features: [...pathState.features, ...queryFeatures.filter((feature) => !pathState.features.some((entry) => entry.id === feature.id))],
        }
      : queryFeatures.length
        ? { features: queryFeatures }
        : null;
    if (state) {
      liveTitle = spaSearchTitle(state, language);
      liveDescription = spaSearchDescription(state, language);
    }
  }

  if (mode === "hourly") {
    const queryLocation = searchParams.get("location") || undefined;
    if (queryLocation) {
      liveTitle = `חדרים לפי שעה ב${queryLocation}`;
      liveDescription = `חדרים וסוויטות לשהייה קצרה ב${queryLocation}, עם סינון לפי מחיר ומאפייני המקום.`;
    }
  }

  return <><h1>{liveTitle}</h1><p>{liveDescription}</p></>;
}

