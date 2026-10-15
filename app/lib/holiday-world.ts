import type { D1Database } from "../../types/cloudflare-runtime";
import type { ContentLocale, ContentSource, EditorialContent } from "./content-studio.ts";
import { contentItemId, readContentItem, readPublishedContent } from "./content-studio.ts";
import type { HomeHoliday } from "./vii-home-holidays.ts";

export type HolidaySearchCard = {
  id: string;
  label: string;
  note: string;
  from: string;
  till: string;
  guests: number;
  accent: "amber" | "berry" | "teal" | "night";
};

export type HolidayWorld = {
  id: number;
  slug: string;
  name: string;
  year: number;
  from: string;
  till: string;
  title: string;
  eyebrow: string;
  summary: string;
  body: string;
  metaTitle: string;
  metaDescription: string;
  indexable: boolean;
  heroImage: string;
  heroImageAlt: string;
  proof: [string, string, string];
  searches: HolidaySearchCard[];
};

const knownSlugs: Array<[RegExp, string]> = [
  [/חנוכה|hanukkah/i, "hanukkah"],
  [/ראש השנה|rosh hashana/i, "rosh-hashana"],
  [/סוכות|sukkot/i, "sukkot"],
  [/שמחת תורה|simchat torah/i, "simchat-torah"],
  [/פסח|passover|pesach/i, "passover"],
  [/שבועות|shavuot/i, "shavuot"],
  [/פורים|purim/i, "purim"],
  [/יום העצמאות|independence/i, "independence-day"],
  [/סיגד|sigd/i, "sigd"],
];

const dayMs = 86_400_000;
const iso = (date: Date) => date.toISOString().slice(0, 10);
const addDays = (value: string, days: number) => iso(new Date(Date.parse(`${value}T00:00:00Z`) + days * dayMs));
const daysBetween = (from: string, till: string) => Math.max(1, Math.round((Date.parse(`${till}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / dayMs));
const dateLabel = (value: string) => new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));

export function holidaySlug(name: string, id?: number) {
  const normalized = name.normalize("NFC").trim();
  return knownSlugs.find(([pattern]) => pattern.test(normalized))?.[1] || `holiday-${id || "upcoming"}`;
}

export function holidayWorldPath(name: string, id?: number) {
  return `/holidays/${holidaySlug(name, id)}`;
}

export function fallbackHolidayForSlug(slug: string): HomeHoliday | null {
  if (slug !== "hanukkah") return null;
  return { id: 0, name: "חנוכה", from: "2026-12-05", till: "2026-12-12", nights: 2, windowSearch: true };
}

function searchCards(holiday: HomeHoliday): HolidaySearchCard[] {
  const duration = daysBetween(holiday.from, holiday.till);
  const middleOffset = Math.max(1, Math.floor(duration / 2) - 1);
  const lastStart = duration > 2 ? addDays(holiday.till, -2) : holiday.from;
  return [
    { id: "couples", label: "חופשה זוגית", note: "שני אורחים, שני לילות בתוך החג", from: holiday.from, till: addDays(holiday.from, Math.min(2, duration)), guests: 2, accent: "berry" },
    { id: "family", label: "משפחה עד 6 אורחים", note: "מקומות שמתאימים לחופשה משפחתית", from: holiday.from, till: addDays(holiday.from, Math.min(2, duration)), guests: 6, accent: "amber" },
    { id: "group", label: "משפחות וקבוצות עד 20", note: "מתחמים גדולים להרכב מורחב", from: holiday.from, till: addDays(holiday.from, Math.min(2, duration)), guests: 20, accent: "teal" },
    { id: "opening", label: `תחילת ${holiday.name}`, note: `${dateLabel(holiday.from)} עד ${dateLabel(addDays(holiday.from, Math.min(2, duration)))}`, from: holiday.from, till: addDays(holiday.from, Math.min(2, duration)), guests: 2, accent: "night" },
    { id: "middle", label: `אמצע ${holiday.name}`, note: "חלון קצר באמצע ימי החג", from: addDays(holiday.from, middleOffset), till: addDays(holiday.from, Math.min(duration, middleOffset + 2)), guests: 2, accent: "teal" },
    { id: "ending", label: `סוף ${holiday.name}`, note: `${dateLabel(lastStart)} עד ${dateLabel(holiday.till)}`, from: lastStart, till: holiday.till, guests: 2, accent: "berry" },
  ].filter((item) => item.from < item.till);
}

function hanukkahCopy(holiday: HomeHoliday) {
  return {
    title: "דילים לחנוכה 2026 שמתחילים בהרכב ובתאריך שלכם",
    eyebrow: "שמונה ימים. הרבה דרכים לצאת לחופשה.",
    summary: "בוחרים זוג, משפחה או קבוצה, מחליטים אם יוצאים בתחילת החג, באמצע או בסופו, וממשיכים ישר לחיפוש שמתאים להרכב שלכם.",
    body: "נר ראשון של חנוכה תשפ״ז יודלק בערב יום שישי, 4 בדצמבר 2026. ימי החג יחולו מיום שבת, 5 בדצמבר, ועד יום שבת, 12 בדצמבר 2026. בגלל שהחג משתרע על פני כמה סופי שבוע וימי חול, חילקנו את החיפוש לחלונות קצרים וברורים במקום להציג רשימה אחת ארוכה ולא מדויקת.",
    metaTitle: "דילים לחנוכה 2026 | נופש לזוגות, משפחות וקבוצות",
    metaDescription: "מוצאים נופש לחנוכה 2026 לפי תאריך והרכב: זוגות, משפחות עד 6 וקבוצות עד 20 אורחים, בתחילת החג, באמצע או בסוף.",
    heroImage: "https://www.vii.co.il/gallery/87686399e3d2342.jpg",
    heroImageAlt: "הילת הנוף בגליל, תמונת המקום",
    proof: ["ערב 4 בדצמבר עד 12 בדצמבר 2026", "חיפוש לפי הרכב", "זמינות נבדקת בזמן אמת"] as [string, string, string],
  };
}

export function defaultHolidayWorld(holiday: HomeHoliday): HolidayWorld {
  const slug = holidaySlug(holiday.name, holiday.id);
  const planningHoliday = slug === "hanukkah" && holiday.from.startsWith("2026-") ? { ...holiday, from: "2026-12-04", till: "2026-12-12" } : holiday;
  const year = Number(planningHoliday.from.slice(0, 4));
  const special = slug === "hanukkah" ? hanukkahCopy(planningHoliday) : {
    title: `דילים ל${planningHoliday.name} ${year}`,
    eyebrow: `מתכננים את ${planningHoliday.name} בדרך שמתאימה לכם`,
    summary: `בוחרים הרכב וחלק בחג וממשיכים לחיפוש נופש ממוקד ל${planningHoliday.name}.`,
    body: `${planningHoliday.name} חל בין ${dateLabel(planningHoliday.from)} לבין ${dateLabel(planningHoliday.till)}. אפשר להתחיל מחיפוש לזוג, למשפחה או לקבוצה, ולבדוק את הזמינות בפועל לתאריכים שבחרתם.`,
    metaTitle: `דילים ל${planningHoliday.name} ${year} | נופש בישראל`,
    metaDescription: `חיפוש נופש ל${planningHoliday.name} ${year} לפי תאריך והרכב, עם מעבר ישיר לזמינות ולמחירים לתקופה שבחרתם.`,
    heroImage: "https://www.vii.co.il/gallery/46686f6045c9036.jpeg",
    heroImageAlt: "מתחם נופש בישראל, תמונת המקום",
    proof: [`${dateLabel(holiday.from)} עד ${dateLabel(holiday.till)}`, "חיפוש לפי הרכב", "זמינות נבדקת בזמן אמת"] as [string, string, string],
  };
  return { id: holiday.id, slug, name: planningHoliday.name, year, from: planningHoliday.from, till: planningHoliday.till,
    ...special, indexable: true, searches: searchCards(planningHoliday) };
}

function applyContent(world: HolidayWorld, content?: EditorialContent | null): HolidayWorld {
  if (!content) return world;
  const attributes = content.attributes || {};
  const proof = world.proof.map((fallback, index) => attributes[`holidayProof${index + 1}`]?.trim() || fallback) as HolidayWorld["proof"];
  return { ...world, title: content.title || world.title, summary: content.summary || world.summary, body: content.body || world.body,
    metaTitle: content.metaTitle || world.metaTitle, metaDescription: content.metaDescription || world.metaDescription,
    indexable: content.indexable, eyebrow: attributes.holidayEyebrow?.trim() || world.eyebrow,
    heroImage: attributes.holidayHeroImage?.trim() || world.heroImage, heroImageAlt: content.imageAlt || world.heroImageAlt, proof };
}

export function holidayContentSource(holiday: HomeHoliday, locale: ContentLocale = "he"): ContentSource {
  const world = defaultHolidayWorld(holiday);
  return { type: "holiday", key: world.slug, world: "vacation", locale, sourceLabel: "VII holiday calendar",
    title: world.title, summary: world.summary, body: world.body, slug: world.slug, imageAlt: world.heroImageAlt,
    indexable: world.indexable, attributes: { holidayEyebrow: world.eyebrow, holidayHeroImage: world.heroImage,
      holidayProof1: world.proof[0], holidayProof2: world.proof[1], holidayProof3: world.proof[2], holidayId: String(world.id), holidayFrom: world.from, holidayTill: world.till } };
}

export async function readHolidayWorld(holiday: HomeHoliday, db?: D1Database | null, locale: ContentLocale = "he") {
  const world = defaultHolidayWorld(holiday);
  if (!db) return world;
  const item = await readContentItem(db, contentItemId("holiday", world.slug, locale)).catch(() => null);
  if (item?.status === "archived") return { ...world, indexable: false };
  const published = await readPublishedContent(db, "holiday", world.slug, locale).catch(() => null);
  return applyContent(world, published?.content);
}

export function holidaySearchHref(card: HolidaySearchCard) {
  return `/search?${new URLSearchParams({ from: card.from, till: card.till, guests: String(card.guests) }).toString()}`;
}
