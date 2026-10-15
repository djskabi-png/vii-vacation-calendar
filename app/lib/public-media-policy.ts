const BANNED_MEDIA_PATHS = new Set([
  "/media/c3a6274bfd08091a.jpeg",
]);

const TOPIC_FALLBACKS = [
  { pattern: /(?:דיר(?:ה|ות)|apartment|עיר|תל אביב)/i, image: "/media/verified/vacation/vacation-tel-aviv-resort-1.jpg" },
  { pattern: /(?:צימר|בקת(?:ה|ות)|cabin|גליל|צפון)/i, image: "/media/verified/vacation/vacation-the-secret-forest-cabin-2.jpeg" },
  { pattern: /(?:ירושלים|jerusalem)/i, image: "/media/verified/vacation/vacation-villa-royal-jerusalem-1.jpeg" },
  { pattern: /(?:נתניה|שרון|ים|חוף|coast)/i, image: "/media/verified/vacation/vacation-vila-tzukey-yam-1.jpg" },
  { pattern: /(?:וילה|וילות|villa|בריכה)/i, image: "/media/322de460abbda5c6.jpg" },
  { pattern: /(?:סוויטה|סוויטות|suite)/i, image: "/media/051ff4fbc8d7d2ac.jpeg" },
  { pattern: /(?:אירוע|מסיבה|event|party)/i, image: "/media/verified/events/events-star-loft-1.jpeg" },
  { pattern: /(?:ספא|spa|טיפול|עיסוי)/i, image: "/media/verified/hourly/hourly-aria-spa-1.jpeg" },
  { pattern: /(?:אטרקציה|פעילות|טיול|activity|attraction)/i, image: "/media/activities/kinneret-day.jpg" },
  { pattern: /(?:ספק|שף|צילום|provider|service)/i, image: "/media/providers/maor-natan-1.jpg" },
] as const;

function normalizedPath(value: string | undefined) {
  if (!value) return "";
  try {
    const url = new URL(value, "https://vii.spaplus.co");
    return url.pathname.toLowerCase();
  } catch {
    return value.trim().split(/[?#]/, 1)[0].toLowerCase();
  }
}

export function isBannedPublicMedia(value: string | undefined) {
  return BANNED_MEDIA_PATHS.has(normalizedPath(value));
}

export function topicFallbackImage(topic: string, fallback?: string) {
  return TOPIC_FALLBACKS.find((entry) => entry.pattern.test(topic))?.image
    || (fallback && !isBannedPublicMedia(fallback) ? fallback : "/media/f18d7c0469633ca0.jpeg");
}

export function resolvePublicSliderMedia({
  image,
  topic,
  fallback,
}: {
  image: string | undefined;
  topic: string;
  fallback?: string;
}) {
  if (image && !isBannedPublicMedia(image)) return { image, fallbackApplied: false };
  return { image: topicFallbackImage(topic, fallback), fallbackApplied: true };
}

export const bannedPublicMediaPaths = [...BANNED_MEDIA_PATHS];
