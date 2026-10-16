export const worldTopicMedia = {
  spa: { src: "/media/world-heroes/spa-v1.webp", alt: "אבני עיסוי ומגבות באווירת ספא" },
  events: { src: "/media/world-heroes/events-v1.webp", alt: "שולחן חגיגי באור נרות" },
  hourly: { src: "/media/world-heroes/hourly-v1.webp", alt: "מצעים רכים ותאורה חמימה למנוחה קצרה" },
  providers: { src: "/media/world-heroes/providers-v1.webp", alt: "הכנת מנות לאירוח בידי שף" },
  attractions: { src: "/media/world-heroes/attractions-v1.webp", alt: "קיאקים ומשוטים לבילוי במים" },
  trails: { src: "/media/world-heroes/trails-v1.webp", alt: "שביל הליכה בטבע בשעת שקיעה" },
} as const;

export type WorldTopic = keyof typeof worldTopicMedia;
export type WorldTopicImage = { src: string; alt: string };

// Deliberately separate from the retired collage keys. Saved business photos
// must not silently reappear as the identity of a whole world after deployment.
export function resolveWorldTopicImage(world: WorldTopic, src?: string, alt?: string): WorldTopicImage {
  const fallback = worldTopicMedia[world];
  const image = src?.trim() || "";
  const description = alt?.trim().slice(0, 160) || "";
  return validWorldTopicImage(image, description) ? { src: image, alt: description } : fallback;
}

export function validWorldTopicImage(src: string, alt: string) {
  return /^\/media\/world-heroes\/[a-z0-9][a-z0-9-]*\.(?:webp|avif|jpg|png)$/.test(src.trim()) && Boolean(alt.trim());
}
