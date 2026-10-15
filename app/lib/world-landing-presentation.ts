import { readPublishedContent, type ContentType, type EditorialContent } from "./content-studio.ts";
import type { D1Database } from "../../types/cloudflare-runtime";

export const managedWorldLandingTypes = ["hourly", "providers", "attractions", "trails"] as const;
export type ManagedWorldLandingType = typeof managedWorldLandingTypes[number];
type HeroImage = { src: string; alt: string };

export type WorldLandingPresentation = {
  title: string;
  description: string;
  eyebrow: string;
  proof: [string, string, string];
  heroImages: [HeroImage, HeroImage, HeroImage];
};

export const defaultWorldLandingPresentations: Record<ManagedWorldLandingType, WorldLandingPresentation> = {
  hourly: {
    title: "חדרים לפי שעה",
    description: "בוחרים אזור ומוצאים מקום פרטי ונעים לשהייה קצרה, בלי להזמין לילה שלם.",
    eyebrow: "כמה שעות שהן רק שלכם",
    proof: ["מקומות מאומתים", "חיפוש לפי אזור ומחיר", "יצירת קשר ישירה"],
    heroImages: [
      { src: "https://www.vii.co.il/gallery/46673b29b3edff5.JPG", alt: "טיטאניק ספא, חדרים לפי שעה בראשון לציון" },
      { src: "https://www.vii.co.il/gallery/2461a5de83befc2.jpg", alt: "קסם בבוסתן, חדרים לפי שעה" },
      { src: "https://www.vii.co.il/gallery/9672c6a4c26523.jpeg", alt: "רום קלאס, חדרים לפי שעה" }
    ]
  },
  providers: {
    title: "ספקים לאירוח ולאירועים",
    description: "שפים, מוזיקה, צילום, עיצוב ופעילויות שמגיעים אל המקום והופכים רעיון לחוויה שלמה.",
    eyebrow: "האנשים שעושים את החוויה",
    proof: ["ספקים שנבדקו", "שירותים בכל הארץ", "הכל במקום אחד"],
    heroImages: [
      { src: "/media/providers/maor-natan-1.jpg", alt: "מאור נתן, שף פרטי וקייטרינג" },
      { src: "/media/providers/amit-mitrani/amit-mitrani-1.webp", alt: "עמית מיטרני, אמן חושים וקוסם" },
      { src: "/media/providers/baboom-1.webp", alt: "באבום, עיצוב בלונים לאירועים" }
    ]
  },
  attractions: {
    title: "אטרקציות בישראל",
    description: "בוחרים אזור וסוג פעילות ומוצאים חוויה שמתאימה בדיוק להרכב ולקצב שלכם.",
    eyebrow: "יוצאים לעשות משהו שזוכרים",
    proof: ["פעילויות בכל הארץ", "התאמה לפי הרכב", "פרטים ברורים מראש"],
    heroImages: [
      { src: "/media/activities/atv-idea.jpg", alt: "טיול שטח וטרקטורונים" },
      { src: "/media/activities/horseback-idea.jpg", alt: "רכיבה מודרכת על סוסים" },
      { src: "/media/activities/eilat-sunset.jpg", alt: "שיט וחוויות ים באילת" }
    ]
  },
  trails: {
    title: "יוצאים מהצימר. נכנסים לישראל היפה.",
    description: "מפלים, מעיינות, חופים, יערות ומדבר. בוחרים לפי אזור, זמן ודרגת קושי ויוצאים עם תוכנית ברורה.",
    eyebrow: "מסלולים שהופקו במיוחד למטיילי VII",
    proof: ["מידע ממקורות רשמיים", "בחירה לפי קושי וזמן", "דגשי בטיחות בכל מסלול"],
    heroImages: [
      { src: "/media/activities/achziv-coast.jpg", alt: "חוף אכזיב והים בגליל המערבי" },
      { src: "/media/activities/mount-zefahot.jpg", alt: "נוף מדברי בהרי אילת" },
      { src: "/media/activities/kinneret-day.jpg", alt: "נוף ומים באזור הכנרת" }
    ]
  }
};

const safeImage = (value: unknown) => {
  if (typeof value !== "string") return "";
  const image = value.trim().slice(0, 400);
  return image.startsWith("/") || /^https:\/\/(?:www\.)?vii\.co\.il\//i.test(image) ? image : "";
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
    heroImages: fallback.heroImages.map((image, index) => ({
      src: safeImage(attributes[`worldHeroImage${index + 1}`]) || image.src,
      alt: attributes[`worldHeroImage${index + 1}Alt`]?.trim().slice(0, 160) || image.alt
    })) as WorldLandingPresentation["heroImages"]
  };
}

export function worldLandingSourceAttributes(type: ManagedWorldLandingType) {
  const value = defaultWorldLandingPresentations[type];
  return {
    worldHeroEyebrow: value.eyebrow,
    worldProof1: value.proof[0], worldProof2: value.proof[1], worldProof3: value.proof[2],
    worldHeroImage1: value.heroImages[0].src, worldHeroImage1Alt: value.heroImages[0].alt,
    worldHeroImage2: value.heroImages[1].src, worldHeroImage2Alt: value.heroImages[1].alt,
    worldHeroImage3: value.heroImages[2].src, worldHeroImage3Alt: value.heroImages[2].alt
  };
}

export function validWorldLandingAttributes(attributes: Record<string, string>) {
  if (!attributes.worldHeroEyebrow?.trim()) return false;
  for (let index = 1; index <= 3; index += 1) {
    if (!attributes[`worldProof${index}`]?.trim() || !safeImage(attributes[`worldHeroImage${index}`]) || !attributes[`worldHeroImage${index}Alt`]?.trim()) return false;
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
    const workerModule = "cloudflare:workers";
    const runtime = await import(/* @vite-ignore */ workerModule);
    return (runtime.env as unknown as { DB?: D1Database }).DB || null;
  } catch { return null; }
}
