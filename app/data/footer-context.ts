import type { WorldId } from "./world-data";

export type FooterLink = { href: string; label: string };
export type FooterContext = { label: string; links: FooterLink[] };
export type FooterTopicId = "vacation-villas" | "suite-complexes" | "luxury-suites" | "vacation-apartments";

const vacationDestinations = ["צפון", "כנרת", "גליל מערבי", "מרכז", "ירושלים", "ים המלח", "אילת"];

function regionalLinks(path: string, regions: string[], label: (region: string) => string): FooterLink[] {
  return regions.map((region) => ({
    href: `${path}${path.includes("?") ? "&" : "?"}location=${encodeURIComponent(region)}`,
    label: label(region),
  }));
}

export const worldFooterContexts: Record<WorldId, FooterContext> = {
  vacation: {
    label: "יעדי נופש פופולריים",
    links: regionalLinks("/search", vacationDestinations, (region) => `נופש ב${region}`),
  },
  events: {
    label: "מקומות לאירועים לפי אזור",
    links: regionalLinks(
      "/events/search",
      ["תל אביב", "מישור החוף והשפלה", "חיפה וחוף הכרמל", "מישור החוף הדרומי", "ראשון לציון", "נשר"],
      (region) => `מקומות לאירועים ב${region}`,
    ),
  },
  corporate: {
    label: "אירועי חברה ורווחה",
    links: [
      { href: "/corporate#corporate-packages", label: "חבילות מוכנות לאירועי חברה" },
      { href: "/corporate#corporate-contact", label: "בניית חבילה עם מומחה" },
      { href: "/corporate#corporate-packages", label: "ימי גיבוש" },
      { href: "/corporate#corporate-packages", label: "רווחה במשרד" },
      { href: "/gift-card", label: "מתנות וגיפט קארד לעובדים" },
    ],
  },
  spa: {
    label: "בתי ספא לפי אזור",
    links: regionalLinks("/spas", ["תל אביב", "ירושלים", "מרכז", "צפון", "חיפה"], (region) => `ספא ב${region}`),
  },
  hourly: {
    label: "חדרים לפי שעה לפי אזור",
    links: regionalLinks("/hourly", ["תל אביב", "ראשון לציון", "חיפה", "ירושלים", "הרצליה"], (region) => `חדרים לפי שעה ב${region}`),
  },
  providers: {
    label: "שירותים לאירוח ולאירועים",
    links: [
      { href: "/providers?category=food", label: "שפים ואוכל" },
      { href: "/providers?category=music", label: "מוזיקה" },
      { href: "/providers?category=photo", label: "צילום" },
      { href: "/providers?category=design", label: "עיצוב" },
      { href: "/providers?category=bar", label: "ברים" },
      { href: "/providers?category=wellness", label: "רווחה ותנועה" },
    ],
  },
  activities: {
    label: "מסלולים ואטרקציות",
    links: [
      { href: "/trails", label: "מסלולי טיולים" },
      { href: "/attractions", label: "אטרקציות בתשלום" },
      { href: "/trails?area=צפון", label: "מסלולים בצפון" },
      { href: "/trails?area=ירושלים", label: "מסלולים בירושלים" },
      { href: "/trails?area=אילת%20והסביבה", label: "מסלולים באילת" },
    ],
  },
};

const vacationTopicDefinitions: Record<FooterTopicId, { label: string; type: string; regions: string[] }> = {
  "vacation-villas": { label: "וילות נופש לפי אזור", type: "וילה", regions: ["צפון", "כנרת", "מרכז", "ירושלים", "אילת"] },
  "suite-complexes": { label: "מתחמי סוויטות לפי אזור", type: "מתחם סוויטות", regions: ["צפון", "כנרת", "מרכז", "ירושלים", "אילת"] },
  "luxury-suites": { label: "סוויטות יוקרה לפי אזור", type: "סוויטות יוקרה", regions: ["צפון", "כנרת", "מרכז", "ירושלים", "אילת"] },
  "vacation-apartments": { label: "דירות נופש לפי אזור", type: "דירת נופש", regions: ["תל אביב", "מרכז", "ירושלים", "אילת"] },
};

export function footerTopicForPropertyType(type: string): FooterTopicId | undefined {
  if (type === "וילה") return "vacation-villas";
  if (type === "מתחם סוויטות" || type === "סוויטות") return "suite-complexes";
  if (type === "סוויטות יוקרה") return "luxury-suites";
  if (type === "דירת נופש") return "vacation-apartments";
  return undefined;
}

export function footerContextFor(variant: WorldId, topic?: FooterTopicId): FooterContext {
  if (!topic) return worldFooterContexts[variant];
  const definition = vacationTopicDefinitions[topic];
  return {
    label: definition.label,
    links: definition.regions.map((region) => ({
      href: `/search?type=${encodeURIComponent(definition.type)}&location=${encodeURIComponent(region)}`,
      label: `${definition.label.replace(" לפי אזור", "")} ב${region}`,
    })),
  };
}
