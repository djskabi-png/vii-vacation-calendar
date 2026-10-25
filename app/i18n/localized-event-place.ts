import type { EventPlace } from "../data/site-data";
import type { SiteLanguage } from "./locale-routing";
import { latinBusinessAlias, localizedBusinessList, localizedBusinessText } from "./localized-business-content";

const copy = {
  he: { name: "מתחם אירועים מאומת", location: "ישראל", type: "מתחם אירועים", description: "מתחם אירועים מאומת עם תמונות, מתקנים ודרכי יצירת קשר." },
  en: { name: "Verified event venue", location: "Israel", type: "Event venue", description: "A verified event venue with photos, amenities and contact options." },
  ru: { name: "Проверенная площадка", location: "Израиль", type: "Площадка для мероприятий", description: "Проверенная площадка с фотографиями, удобствами и контактами." },
  fr: { name: "Lieu événementiel vérifié", location: "Israël", type: "Lieu événementiel", description: "Un lieu événementiel vérifié avec photos, équipements et contacts." },
} satisfies Record<SiteLanguage, Record<"name" | "location" | "type" | "description", string>>;

export function localizedEventPlace(place: EventPlace, language: SiteLanguage, translate: (value: string) => string): EventPlace {
  if (language === "he") return place;
  const fallback = copy[language];
  const name = localizedBusinessText(place.name, language, translate, latinBusinessAlias(place.name) || fallback.name);
  const location = localizedBusinessText(place.location, language, translate, latinBusinessAlias(place.location) || fallback.location);
  const area = localizedBusinessText(place.area, language, translate, latinBusinessAlias(place.area) || fallback.location);
  return {
    ...place,
    name,
    location,
    area,
    type: localizedBusinessText(place.type, language, translate, fallback.type),
    description: localizedBusinessText(place.description, language, translate, fallback.description),
    features: localizedBusinessList(place.features, language, translate),
    audiences: localizedBusinessList(place.audiences, language, translate),
    eventTypes: localizedBusinessList(place.eventTypes, language, translate),
  };
}
