import type { DiscoveryItem } from "./world-data";
import hourlyCatalog from "./sergey-hourly-catalog.json";

export type HourlyDetails = {
  about: string[];
  stayOptions: { title: string; description: string }[];
  rates: { duration: string; price: string }[];
  amenities: string[];
  arrivalNotes: string[];
  faq: { question: string; answer: string }[];
};

function sourcePlace(itemId: string) {
  return hourlyCatalog.places.find((place) => place.id === itemId);
}

export function verifiedHourlyPrice(itemId: string, duration: string): number | undefined {
  const prices = sourcePlace(itemId)?.rooms.flatMap((room) => room.rates
    .filter((rate) => rate.duration === duration)
    .flatMap((rate) => [rate.weekday, rate.weekend])
    .filter((price): price is number => typeof price === "number" && price > 0)) || [];
  return prices.length ? Math.min(...prices) : undefined;
}

export function getHourlyDetails(item: DiscoveryItem): HourlyDetails {
  const place = sourcePlace(item.id);
  const rates = place?.rooms.flatMap((room) => room.rates.flatMap((rate) => [
    ...(rate.weekday ? [{ duration: `${room.name || "חדר"} · ${rate.duration} · יום חול`, price: `${rate.weekday} ₪` }] : []),
    ...(rate.weekend ? [{ duration: `${room.name || "חדר"} · ${rate.duration} · סוף שבוע`, price: `${rate.weekend} ₪` }] : []),
  ])) || [];
  return {
    about: [item.description],
    stayOptions: place?.rooms.map((room) => ({
      title: room.name || "יחידת אירוח",
      description: [
        room.count ? `${room.count} יחידות` : "",
        room.maxGuests ? `עד ${room.maxGuests} אורחים ביחידה` : "",
        ...room.features,
      ].filter(Boolean).join(" · ") || "פרטי החדר טרם נמסרו ב־API.",
    })) || [],
    rates,
    amenities: item.features,
    arrivalNotes: [
      "מחירי הבסיס מגיעים מה־API של VII. יש לאשר את המחיר הסופי ואת השעה הפנויה מול המקום.",
      "ב־API עדיין אין בדיקת זמינות או אפשרות להזמנה מקוונת לחדרים לפי שעה.",
    ],
    faq: [
      { question: "איך יודעים אם החדר פנוי?", answer: "מתקשרים למקום ומאשרים את התאריך, השעה, משך השהייה והחדר הרצוי." },
      { question: "האם המחיר שמוצג הוא סופי?", answer: "אלה מחירי בסיס מה־API. המקום מאשר בשיחה את המחיר הסופי לשעה ולחדר המבוקשים." },
    ],
  };
}
