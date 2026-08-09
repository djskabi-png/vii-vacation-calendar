import type { DiscoveryItem } from "./world-data";

export const spaLandings = [
  { id: "hotel", slug: "hotel-spa", label: "ספא בבית מלון", title: "ספא בבתי מלון בישראל", description: "מתחמי ספא בבתי מלון עם טיפולים, מתקנים וחבילות שאפשר להשוות לפי אזור.", terms: ["מלון"] },
  { id: "boutique", slug: "boutique-spa", label: "ספא בוטיק או פרטי", title: "ספא בוטיק וספא פרטי", description: "בתי ספא בוטיק ומתחמים פרטיים לחוויה שקטה, אישית וזוגית.", terms: ["בוטיק", "פרטי", "סוויטה פרטית"] },
  { id: "pool", slug: "spa-with-pool", label: "בריכה", title: "ספא עם בריכה", description: "מתחמי ספא עם בריכה וחבילות טיפול שאפשר להשוות במקום אחד.", terms: ["בריכה", "בריכות"] },
  { id: "jacuzzi", slug: "spa-with-jacuzzi", label: "ג׳קוזי", title: "ספא עם ג׳קוזי", description: "בתי ספא וחבילות פינוק הכוללים ג׳קוזי כחלק מהחוויה.", terms: ["ג׳קוזי", "ג'קוזי"] },
  { id: "sauna", slug: "spa-with-sauna", label: "סאונה", title: "ספא עם סאונה", description: "מתחמי ספא עם סאונה יבשה, רטובה או מתקני חום מאומתים.", terms: ["סאונה", "סאונות"] },
  { id: "gym", slug: "spa-with-gym", label: "חדר כושר", title: "ספא עם חדר כושר", description: "מתחמי ספא המשלבים טיפולים וגישה לחדר כושר.", terms: ["חדר כושר"] },
  { id: "couples", slug: "couples-spa", label: "חבילה זוגית", title: "חבילות ספא זוגיות", description: "חבילות ספא לזוגות עם טיפולים ומתקנים שמתאימים ליום משותף.", terms: ["זוג", "זוגי", "זוגיות"] },
  { id: "day-pass", slug: "spa-day", label: "יום כיף", title: "יום כיף בספא", description: "ימי כיף בספא עם טיפולים, מתקנים ואפשרויות בילוי לאורך היום.", terms: ["יום כיף"] },
  { id: "meal", slug: "spa-with-meal", label: "חבילה עם ארוחה", title: "חבילות ספא עם ארוחה", description: "חבילות ספא המשלבות טיפול עם ארוחה או ארוחת בוקר.", terms: ["ארוחה", "ארוחת בוקר"] },
] as const;

export type SpaLanding = (typeof spaLandings)[number];

export function getSpaLanding(slug: string | undefined) {
  return spaLandings.find((landing) => landing.slug === slug);
}

export function spaLandingHref(landing: SpaLanding) {
  return `/spas/${landing.slug}`;
}

export function spaItemMatches(item: DiscoveryItem, landing: SpaLanding) {
  const text = `${item.name} ${item.description} ${item.features.join(" ")}`;
  return landing.terms.some((term) => text.includes(term));
}
