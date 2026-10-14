import type { SiteLanguage } from "../i18n/locale-routing.ts";
import type { SearchWorld } from "./search-analytics.ts";

export const publicSearchWorldSegments: Record<SearchWorld, string> = {
  vacation: "vacations",
  events: "events",
  spa: "spas",
  hourly: "hourly",
};

export function searchWorldFromPublicSegment(value: string): SearchWorld | null {
  return (Object.entries(publicSearchWorldSegments).find(([, segment]) => segment === value)?.[0] as SearchWorld | undefined) || null;
}

export function validSearchPageSlug(value: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 120;
}

export function publicSearchPagePath(world: SearchWorld, slug: string, locale: SiteLanguage = "he") {
  if (!validSearchPageSlug(slug)) throw new Error("invalid_search_page_slug");
  const base = `/search/${publicSearchWorldSegments[world]}/${slug}`;
  return locale === "he" ? base : `/${locale}${base}`;
}

export function privateSearchPageEditorPath(id: string) {
  return `/admin/search-pages?id=${encodeURIComponent(id)}`;
}

export function publicationEligible(status: string, robotsIndex: boolean, scheduledAt: string | null, now = Date.now()) {
  if (!robotsIndex) return false;
  if (status === "published") return true;
  if (status !== "scheduled" || !scheduledAt) return false;
  const instant = new Date(scheduledAt).getTime();
  return Number.isFinite(instant) && instant <= now;
}

