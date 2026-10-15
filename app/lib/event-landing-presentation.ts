import { readPublishedContent, type EditorialContent } from "./content-studio.ts";
import type { D1Database } from "../../types/cloudflare-runtime";
import { isBannedPublicMedia, resolvePublicSliderMedia } from "./public-media-policy.ts";

export type EventLandingSearchItem = {
  id: string;
  label: string;
  note: string;
  href: string;
  image: string;
  imageAlt: string;
  visible: boolean;
};

type HeroImage = { src: string; alt: string };

const defaultQuickSearches: EventLandingSearchItem[] = [
  { id: "birthdays", label: "ימי הולדת", note: "לופטים ומתחמים לחגיגה", href: "/events/search?eventType=יום+הולדת", image: "https://www.vii.co.il/gallery/5962a5b1c42c285.jpeg", imageAlt: "מתחם מעוצב לחגיגת יום הולדת", visible: true },
  { id: "family", label: "אירועים משפחתיים", note: "מקום שמתאים לכל המשפחה", href: "/events/search?eventType=אירוע+משפחתי", image: "https://www.vii.co.il/gallery/44677127ddf2c2e.jpeg", imageAlt: "מתחם לאירוע משפחתי", visible: true },
  { id: "large", label: "מעל 100 משתתפים", note: "מתחמים שמתאימים לאירוע גדול", href: "/events/search?guests=100", image: "https://www.vii.co.il/gallery/67659401a5b852d.jpeg", imageAlt: "אולם לאירוע רב משתתפים", visible: true },
  { id: "noise", label: "ללא הגבלת רעש", note: "מקומות למסיבה שנמשכת", href: "/events/search?noise=1", image: "https://www.vii.co.il/gallery/9862975a4a90481.JPG", imageAlt: "מתחם למסיבה פרטית", visible: true },
  { id: "center", label: "אירועים במרכז", note: "קרוב ונגיש לאורחים", href: "/events/search?location=מרכז", image: "https://www.vii.co.il/gallery/8266f8f7940fa93.jpg", imageAlt: "מקום לאירועים באזור המרכז", visible: true },
  { id: "tel-aviv", label: "אירועים בתל אביב", note: "אווירה עירונית בלב העניינים", href: "/events/search?location=תל+אביב", image: "https://www.vii.co.il/gallery/3465c34aea44623.jpeg", imageAlt: "לופט לאירועים בתל אביב", visible: true }
];

export const defaultEventLandingPresentation = {
  title: "מוצאים מקום לחגוג בו",
  description: "בוחרים אזור, תאריך וכמות משתתפים ומוצאים מקום שמתאים בדיוק לאירוע שלכם.",
  eyebrow: "האירוע שלכם מתחיל כאן",
  proof: ["מקומות בכל הארץ", "חיפוש לפי כמות וסוג אירוע", "השוואה במקום אחד"],
  heroImages: [
    { src: "https://www.vii.co.il/gallery/956736033706edb.JPG", alt: "מתחם אירועים פתוח מול הנוף" },
    { src: "https://www.vii.co.il/gallery/33682d8fa6e9f0f.jpg", alt: "וילה מעוצבת לאירוע פרטי" },
    { src: "https://www.vii.co.il/gallery/196a6071f6c6fb5.jpg", alt: "לופט מעוצב למסיבה ואירוע" }
  ] satisfies HeroImage[],
  quickSearchEyebrow: "מתחילים מהסגנון שלכם",
  quickSearchTitle: "חיפושים מהירים לאירוע",
  quickSearches: defaultQuickSearches
};

function safeImage(value: unknown) {
  if (typeof value !== "string") return "";
  const image = value.trim().slice(0, 400);
  if (isBannedPublicMedia(image)) return "";
  return image.startsWith("/") || /^https:\/\/(?:www\.)?vii\.co\.il\//i.test(image) ? image : "";
}

function safePath(value: unknown) {
  if (typeof value !== "string") return "";
  const path = value.trim().slice(0, 300);
  return path.startsWith("/") && !path.startsWith("//") ? path : "";
}

function parseQuickSearches(value: string | undefined) {
  if (!value) return defaultQuickSearches;
  try {
    const rows = JSON.parse(value) as unknown;
    if (!Array.isArray(rows)) return defaultQuickSearches;
    const parsed = rows.slice(0, 12).flatMap((entry, index) => {
      if (!entry || typeof entry !== "object") return [];
      const row = entry as Record<string, unknown>;
      const label = typeof row.label === "string" ? row.label.trim().slice(0, 70) : "";
      const href = safePath(row.href);
      const requestedImage = typeof row.image === "string" ? row.image.trim().slice(0, 400) : "";
      const imageAlt = typeof row.imageAlt === "string" ? row.imageAlt.trim().slice(0, 140) : "";
      if (!label || !href || !requestedImage || !imageAlt) return [];
      const media = resolvePublicSliderMedia({
        image: requestedImage,
        topic: `${typeof row.id === "string" ? row.id : ""} ${label} ${href}`,
        fallback: defaultQuickSearches[index]?.image,
      });
      return [{
        id: typeof row.id === "string" && row.id.trim() ? row.id.trim().slice(0, 60) : `event-search-${index + 1}`,
        label,
        note: typeof row.note === "string" ? row.note.trim().slice(0, 120) : "",
        href,
        image: media.image,
        imageAlt: media.fallbackApplied ? `${label}, תמונת אווירה` : imageAlt,
        visible: row.visible !== false
      }];
    });
    return parsed.length ? parsed : defaultQuickSearches;
  } catch {
    return defaultQuickSearches;
  }
}

export function parseEventLandingPresentation(content?: EditorialContent | null) {
  const attributes = content?.attributes || {};
  const heroImages = defaultEventLandingPresentation.heroImages.map((fallback, index) => ({
    src: safeImage(attributes[`eventHeroImage${index + 1}`]) || fallback.src,
    alt: attributes[`eventHeroImage${index + 1}Alt`]?.trim().slice(0, 140) || fallback.alt
  }));
  return {
    title: content?.title?.trim() || defaultEventLandingPresentation.title,
    description: content?.summary?.trim() || defaultEventLandingPresentation.description,
    eyebrow: attributes.eventHeroEyebrow?.trim().slice(0, 90) || defaultEventLandingPresentation.eyebrow,
    proof: defaultEventLandingPresentation.proof.map((fallback, index) => attributes[`eventProof${index + 1}`]?.trim().slice(0, 90) || fallback),
    heroImages,
    quickSearchEyebrow: attributes.eventQuickSearchEyebrow?.trim().slice(0, 90) || defaultEventLandingPresentation.quickSearchEyebrow,
    quickSearchTitle: attributes.eventQuickSearchTitle?.trim().slice(0, 100) || defaultEventLandingPresentation.quickSearchTitle,
    quickSearches: parseQuickSearches(attributes.eventQuickSearches).filter((item) => item.visible)
  };
}

export function eventLandingSourceAttributes() {
  return {
    eventHeroEyebrow: defaultEventLandingPresentation.eyebrow,
    eventProof1: defaultEventLandingPresentation.proof[0],
    eventProof2: defaultEventLandingPresentation.proof[1],
    eventProof3: defaultEventLandingPresentation.proof[2],
    eventHeroImage1: defaultEventLandingPresentation.heroImages[0].src,
    eventHeroImage1Alt: defaultEventLandingPresentation.heroImages[0].alt,
    eventHeroImage2: defaultEventLandingPresentation.heroImages[1].src,
    eventHeroImage2Alt: defaultEventLandingPresentation.heroImages[1].alt,
    eventHeroImage3: defaultEventLandingPresentation.heroImages[2].src,
    eventHeroImage3Alt: defaultEventLandingPresentation.heroImages[2].alt,
    eventQuickSearchEyebrow: defaultEventLandingPresentation.quickSearchEyebrow,
    eventQuickSearchTitle: defaultEventLandingPresentation.quickSearchTitle,
    eventQuickSearches: JSON.stringify(defaultQuickSearches)
  };
}

export function validEventLandingAttributes(attributes: Record<string, string>) {
  if (!attributes.eventHeroEyebrow?.trim() || !attributes.eventQuickSearchTitle?.trim()) return false;
  for (let index = 1; index <= 3; index += 1) {
    if (!safeImage(attributes[`eventHeroImage${index}`]) || !attributes[`eventHeroImage${index}Alt`]?.trim()) return false;
  }
  try {
    const rows = JSON.parse(attributes.eventQuickSearches || "") as unknown;
    if (!Array.isArray(rows) || rows.length < 4 || rows.length > 12) return false;
    return rows.every((entry) => {
      if (!entry || typeof entry !== "object") return false;
      const row = entry as Record<string, unknown>;
      return typeof row.label === "string" && Boolean(row.label.trim()) && Boolean(safePath(row.href)) && Boolean(safeImage(row.image))
        && typeof row.imageAlt === "string" && Boolean(row.imageAlt.trim()) && typeof row.visible === "boolean";
    });
  } catch {
    return false;
  }
}

export async function readEventLandingPresentation() {
  const db = await eventLandingDatabase();
  if (!db) return defaultEventLandingPresentation;
  const content = await readPublishedContent(db, "events", "landing", "he").catch(() => null);
  return parseEventLandingPresentation(content?.content);
}

async function eventLandingDatabase(): Promise<D1Database | null> {
  try {
    // This module is rendered only on the server. Keeping the Worker binding
    // import opaque prevents Vinext from pulling a Cloudflare-only module into
    // the browser bundle while preserving the real production D1 binding.
    const workerModule = "cloudflare:workers";
    const runtime = await import(/* @vite-ignore */ workerModule);
    return (runtime.env as unknown as { DB?: D1Database }).DB || null;
  } catch {
    return null;
  }
}
