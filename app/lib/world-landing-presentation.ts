import { readPublishedContent, type ContentType, type EditorialContent } from "./content-studio.ts";
import type { D1Database } from "../../types/cloudflare-runtime";
import { resolveWorldTopicImage, validWorldTopicImage, worldTopicMedia } from "./world-topic-media.ts";
import { runtimeDatabase } from "./runtime-database.ts";

export const managedWorldLandingTypes = ["hourly", "providers", "attractions", "trails", "spa"] as const;
export type ManagedWorldLandingType = typeof managedWorldLandingTypes[number];
type HeroImage = { src: string; alt: string };

export type WorldLandingPresentation = {
  title: string;
  description: string;
  eyebrow: string;
  proof: [string, string, string];
  heroImages: [HeroImage];
};

export const defaultWorldLandingPresentations: Record<ManagedWorldLandingType, WorldLandingPresentation> = {
  spa: {
    title: "בתי ספא בישראל", description: "בוחרים אזור, תאריך וסוג חוויה ומוצאים את הספא שמתאים לכם.",
    eyebrow: "הפסקה טובה מתחילה כאן", proof: ["מחירים וחבילות במקום אחד", "חיפוש לפי אזור וחוויה", "הכל במקום אחד"],
    heroImages: [worldTopicMedia.spa]
  },
  hourly: {
    title: "חדרים לפי שעה",
    description: "בוחרים אזור ומוצאים מקום פרטי ונעים לשהייה קצרה, בלי להזמין לילה שלם.",
    eyebrow: "כמה שעות שהן רק שלכם",
    proof: ["מקומות מאומתים", "חיפוש לפי אזור ומחיר", "יצירת קשר ישירה"],
    heroImages: [worldTopicMedia.hourly]
  },
  providers: {
    title: "ספקים לאירוח ולאירועים",
    description: "שפים, מוזיקה, צילום, עיצוב ופעילויות שמגיעים אל המקום והופכים רעיון לחוויה שלמה.",
    eyebrow: "האנשים שעושים את החוויה",
    proof: ["ספקים שנבדקו", "שירותים בכל הארץ", "הכל במקום אחד"],
    heroImages: [worldTopicMedia.providers]
  },
  attractions: {
    title: "אטרקציות בישראל",
    description: "בוחרים אזור וסוג פעילות ומוצאים חוויה שמתאימה בדיוק להרכב ולקצב שלכם.",
    eyebrow: "יוצאים לעשות משהו שזוכרים",
    proof: ["פעילויות בכל הארץ", "התאמה לפי הרכב", "פרטים ברורים מראש"],
    heroImages: [worldTopicMedia.attractions]
  },
  trails: {
    title: "יוצאים מהצימר. נכנסים לישראל היפה.",
    description: "מפלים, מעיינות, חופים, יערות ומדבר. בוחרים לפי אזור, זמן ודרגת קושי ויוצאים עם תוכנית ברורה.",
    eyebrow: "מסלולים שהופקו במיוחד למטיילי VII",
    proof: ["מידע ממקורות רשמיים", "בחירה לפי קושי וזמן", "דגשי בטיחות בכל מסלול"],
    heroImages: [worldTopicMedia.trails]
  }
};

export function isManagedWorldLandingType(value: string): value is ManagedWorldLandingType {
  return managedWorldLandingTypes.includes(value as ManagedWorldLandingType);
}

export function parseWorldLandingPresentation(type: ManagedWorldLandingType, content?: EditorialContent | null): WorldLandingPresentation {
  const fallback = defaultWorldLandingPresentations[type];
  const attributes = content?.attributes || {};
  return {
    title: content?.title?.trim() || fallback.title,
    description: content?.summary?.trim() || fallback.description,
    eyebrow: attributes.worldHeroEyebrow?.trim().slice(0, 100) || fallback.eyebrow,
    proof: fallback.proof.map((value, index) => attributes[`worldProof${index + 1}`]?.trim().slice(0, 100) || value) as WorldLandingPresentation["proof"],
    heroImages: [resolveWorldTopicImage(type, attributes.worldTopicImage, attributes.worldTopicImageAlt)]
  };
}

export function worldLandingSourceAttributes(type: ManagedWorldLandingType) {
  const value = defaultWorldLandingPresentations[type];
  return {
    worldHeroEyebrow: value.eyebrow,
    worldProof1: value.proof[0], worldProof2: value.proof[1], worldProof3: value.proof[2],
    worldTopicImage: value.heroImages[0].src, worldTopicImageAlt: value.heroImages[0].alt
  };
}

export function validWorldLandingAttributes(attributes: Record<string, string>) {
  if (!attributes.worldHeroEyebrow?.trim()) return false;
  if (!validWorldTopicImage(attributes.worldTopicImage || "", attributes.worldTopicImageAlt || "")) return false;
  for (let index = 1; index <= 3; index += 1) {
    if (!attributes[`worldProof${index}`]?.trim()) return false;
  }
  return true;
}

export async function readWorldLandingPresentation(type: ManagedWorldLandingType) {
  const db = await worldLandingDatabase();
  if (!db) return defaultWorldLandingPresentations[type];
  const published = await readPublishedContent(db, type as ContentType, "landing", "he").catch(() => null);
  return parseWorldLandingPresentation(type, published?.content);
}

async function worldLandingDatabase(): Promise<D1Database | null> {
  try {
    return await runtimeDatabase() || null;
  } catch { return null; }
}
