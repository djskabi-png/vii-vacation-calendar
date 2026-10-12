import { spaPlusAudience, spaPlusSiteById, type SpaPlusSite } from "./spaplus";
import { spaEditorialSummary } from "./spa-editorial";

export type SpaPackage = {
  id: string;
  title: string;
  audience: "יחיד" | "זוג" | "קבוצה" | "יום כיף" | "לא צוין";
  price: string;
  duration?: string;
  includes: string[];
  image?: string;
  bookingUrl: string;
};

export type SpaDetails = {
  siteId: number;
  editorialSummary: string;
  packages: SpaPackage[];
  facilities: string[];
  treatments?: { name: string; durations?: string[]; priceNote?: string }[];
  suitableFor: string[];
  address?: string;
  phone?: string;
  hours: string[];
  arrivalNotes?: string[];
  faq?: { question: string; answer: string }[];
  bookingUrl: string;
};

const weekdays = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

export function publicSpaBookingUrl(value: string): string {
  const url = new URL(value);
  url.searchParams.delete("isFrame");
  url.searchParams.delete("ispackFrame");
  return url.toString();
}

export function getSpaDetails(id: string, suppliedSite?: SpaPlusSite): SpaDetails | undefined {
  const site = suppliedSite || spaPlusSiteById(id);
  if (!site) return undefined;
  const packages: SpaPackage[] = site.packages.map((pack) => ({
    id: String(pack.id),
    title: pack.title,
    audience: spaPlusAudience(pack),
    price: `${pack.price.toLocaleString("he-IL")} ₪`,
    duration: pack.durationMinutes ? `${pack.durationMinutes} דקות` : undefined,
    includes: [],
    image: pack.image || undefined,
    bookingUrl: publicSpaBookingUrl(pack.bookingUrl || site.bookingUrl!),
  }));
  const suitableFor = [...new Set(packages.map((pack) => pack.audience).filter((value) => value !== "לא צוין"))];
  const hours = site.opening.map((time, index) => `${weekdays[index] || `יום ${index + 1}`}: ${time === "closed" ? "סגור" : time}`);
  return {
    siteId: site.id,
    editorialSummary: spaEditorialSummary(site),
    packages,
    facilities: [],
    suitableFor,
    address: [site.address, site.city].filter(Boolean).join(", "),
    phone: site.phone || undefined,
    hours,
    bookingUrl: publicSpaBookingUrl(site.bookingUrl!),
  };
}
