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

const topicTranslations = {
  en: ["Massage stones and towels in a spa setting", "A candlelit celebration table", "Soft linen and warm lighting for a short rest", "A chef preparing food for a gathering", "Kayaks and paddles for a day on the water", "A nature trail at sunset"],
  fr: ["Pierres de massage et serviettes dans une ambiance de spa", "Une table de fête éclairée aux bougies", "Du linge doux et une lumière chaleureuse pour une courte pause", "Un chef préparant des plats pour une réception", "Kayaks et pagaies pour une sortie sur l’eau", "Un sentier dans la nature au coucher du soleil"],
  ru: ["Массажные камни и полотенца в атмосфере спа", "Праздничный стол при свечах", "Мягкое бельё и тёплый свет для короткого отдыха", "Шеф-повар готовит блюда для гостей", "Каяки и вёсла для отдыха на воде", "Природная тропа на закате"],
} as const;

export function worldTopicImageCopy(image: WorldTopicImage, locale: string) {
  const index = Object.values(worldTopicMedia).findIndex((value) => value.alt === image.alt);
  if (locale !== "en" && locale !== "fr" && locale !== "ru") return { alt: image.alt, caption: "תמונת המחשה" };
  return { alt: index >= 0 ? topicTranslations[locale][index] : image.alt,
    caption: { en: "Illustrative image", fr: "Image d’illustration", ru: "Иллюстративное изображение" }[locale] };
}

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
