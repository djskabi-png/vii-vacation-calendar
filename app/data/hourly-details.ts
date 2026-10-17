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

type HourlyPlace = (typeof hourlyCatalog.places)[number];

function sourcePlace(itemId: string, suppliedPlace?: HourlyPlace) {
  return suppliedPlace || hourlyCatalog.places.find((place) => place.id === itemId);
}

export function verifiedHourlyPrice(itemId: string, duration: string): number | undefined {
  const prices = sourcePlace(itemId)?.rooms.flatMap((room) => room.rates
    .filter((rate) => rate.duration === duration)
    .flatMap((rate) => [rate.weekday, rate.weekend])
    .filter((price): price is number => typeof price === "number" && price > 0)) || [];
  return prices.length ? Math.min(...prices) : undefined;
}

export function getHourlyDetails(item: DiscoveryItem, suppliedPlace?: HourlyPlace): HourlyDetails {
  const place = sourcePlace(item.id, suppliedPlace);
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
      ].filter(Boolean).join(" · ") || "לפרטי החדר ולתיאום שהייה, פנו למקום.",
    })) || [],
    rates,
    amenities: item.features,
    arrivalNotes: [
      "לתיאום השהייה, מאשרים עם המקום את התאריך, השעה, משך האירוח והמחיר.",
    ],
    faq: [
      { question: "איך יודעים אם החדר פנוי?", answer: "מתקשרים למקום ומאשרים את התאריך, השעה, משך השהייה והחדר הרצוי." },
      { question: "האם המחיר שמוצג הוא סופי?", answer: "המחירים המוצגים הם מחירי בסיס. המקום מאשר בשיחה את המחיר הסופי לשעה ולחדר המבוקשים." },
    ],
  };
}
