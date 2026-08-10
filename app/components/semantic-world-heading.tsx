"use client";

import { usePathname, useSearchParams } from "next/navigation";
import type { SearchMode } from "../data/search-taxonomy";
import { searchLocationFromSlug } from "../data/world-search-landings";
import { spaSearchDescription, spaSearchStateFromSegments, spaSearchTitle } from "../data/spa-search-landings";
import { spaLandings } from "../data/spa-landings";

export function SemanticWorldHeading({ mode, title, description }: { mode?: SearchMode; title: string; description: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
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
      liveTitle = spaSearchTitle(state);
      liveDescription = spaSearchDescription(state);
    }
  }

  if (mode === "hourly") {
    const parts = pathname.split("/").filter(Boolean);
    const hourlyIndex = parts.indexOf("hourly");
    const location = hourlyIndex >= 0 && parts[hourlyIndex + 1] === "search" ? searchLocationFromSlug("hourly", parts[hourlyIndex + 2]) : undefined;
    if (location) {
      liveTitle = `חדרים לפי שעה ב${location}`;
      liveDescription = `חדרים וסוויטות לשהייה קצרה ב${location}, עם סינון לפי מחיר ומאפייני המקום.`;
    }
  }

  return <><h1>{liveTitle}</h1><p>{liveDescription}</p></>;
}
