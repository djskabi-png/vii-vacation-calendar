import { matchesSearchLocation } from "../data/search-taxonomy.ts";

// Region labels are the existing search taxonomy, not supplier geographic IDs.
// A city ID and a district ID may be equal and must never be joined by ID alone.
const regions = [
  ["north", "צפון", "Northern Israel", "северной части Израиля", "nord d’Israël"],
  ["center", "מרכז", "Central Israel", "центральной части Израиля", "centre d’Israël"],
  ["south", "דרום", "Southern Israel", "южной части Израиля", "sud d’Israël"],
  ["south-negev", "דרום ונגב", "Southern Israel and the Negev", "южной части Израиля и Негеве", "sud d’Israël et Néguev"],
  ["kinneret", "כנרת", "the Sea of Galilee", "районе Кинерета", "lac de Tibériade"],
  ["western-galilee", "גליל מערבי", "Western Galilee", "Западной Галилее", "Galilée occidentale"],
  ["upper-galilee", "גליל עליון", "Upper Galilee", "Верхней Галилее", "Haute-Galilée"],
  ["golan", "רמת הגולן", "the Golan Heights", "районе Голанских высот", "plateau du Golan"],
  ["haifa-carmel", "חיפה והכרמל", "Haifa and Carmel", "Хайфе и районе Кармеля", "Haïfa et Carmel"],
  ["haifa", "חיפה", "Haifa", "Хайфе", "Haïfa"],
  ["sharon", "השרון", "the Sharon region", "районе Шарона", "région du Sharon"],
  ["sharon-short", "שרון", "the Sharon region", "районе Шарона", "région du Sharon"],
  ["coastal-plain", "מישור החוף והשפלה", "the Coastal Plain", "Прибрежной равнине", "plaine côtière"],
  ["tel-aviv", "תל אביב", "Tel Aviv", "Тель-Авиве", "Tel-Aviv"],
  ["jerusalem", "ירושלים והסביבה", "Jerusalem and its surroundings", "Иерусалиме и окрестностях", "Jérusalem et environs"],
  ["judean-hills", "ירושלים והרי יהודה", "Jerusalem and the Judean Hills", "Иерусалиме и Иудейских горах", "Jérusalem et monts de Judée"],
  ["dead-sea", "ים המלח", "the Dead Sea", "районе Мёртвого моря", "mer Morte"],
  ["eilat", "אילת והערבה", "Eilat and the Arava", "Эйлате и Араве", "Eilat et Arava"],
  ["eilat-area", "אילת והסביבה", "Eilat and its surroundings", "Эйлате и окрестностях", "Eilat et environs"],
] as const;

export type AvailabilityWorld = "vacation" | "events" | "spa";
export function regionalAvailabilityRegion(value?: string | null) {
  const match = regions.find(region => region[1] === value?.trim());
  return match ? { key: match[0], label: match[1], en: match[2], ru: match[3], fr: match[4] } : null;
}

export function regionalAvailabilityTitle(world: AvailabilityWorld, region: NonNullable<ReturnType<typeof regionalAvailabilityRegion>>, language: "he" | "en" | "ru" | "fr") {
  const nouns = {
    he: { vacation: "נופש פנוי", events: "מקומות פנויים לאירועים", spa: "חבילות ספא לימים הקרובים" },
    en: { vacation: "Available stays", events: "Available event venues", spa: "Spa packages for the coming days" },
    ru: { vacation: "Свободное жильё", events: "Свободные площадки для мероприятий", spa: "Спа-пакеты на ближайшие дни" },
    fr: { vacation: "Séjours disponibles", events: "Lieux disponibles pour vos événements", spa: "Formules spa pour les prochains jours" },
  };
  return language === "he" ? `${nouns.he[world]} ב${region.label}`
    : language === "ru" ? `${nouns.ru[world]} в ${region.ru}`
    : language === "en" ? `${nouns.en[world]} in ${region.en}`
    : `${nouns.fr[world]} : ${region.fr}`;
}

export function regionalPublishedIds<T extends { supplierId: number; area?: string; location?: string }>(places: readonly T[], publicIds: ReadonlySet<number>, region?: string) {
  return new Set(places.filter(place => publicIds.has(place.supplierId) && (!region || matchesSearchLocation(place, region))).map(place => place.supplierId));
}
