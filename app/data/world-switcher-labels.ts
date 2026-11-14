import { publicWorldNavigation } from "./world-navigation";
import type { SiteLanguage } from "../i18n/locale-routing";

const giftCardWorld = {
  id: "gift-card",
  label: "גיפט קארד",
  shortLabel: "גיפט קארד",
  description: "כל החופשה, במתנה אחת",
  href: "/gift-card",
} as const;

const headerWorldNavigation = [...publicWorldNavigation, giftCardWorld] as const;
const order = ["vacation", "spa", "events", "hourly", "attractions", "trails", "providers", "corporate", "gift-card"] as const;
const labels = {
  he: ["נופש", "ספא", "אירועים", "חדרים לפי שעה", "אטרקציות", "טיולים", "ספקים", "אירועי חברה ורווחה", "גיפט קארד"],
  en: ["Stays", "Spa", "Events", "Hourly rooms", "Attractions", "Trails", "Providers", "Corporate events", "Gift card"],
  fr: ["Séjours", "Spa", "Événements", "Chambres à l’heure", "Activités", "Balades", "Prestataires", "Événements d’entreprise", "Carte cadeau"],
  ru: ["Отдых", "Спа", "Мероприятия", "Номера по часам", "Развлечения", "Маршруты", "Услуги", "Корпоративные события", "Подарочная карта"],
} as const;

export function headerWorldOptions(language: SiteLanguage) {
  return order.map((id, index) => ({
    ...headerWorldNavigation.find((world) => world.id === id)!,
    label: labels[language][index],
  }));
}

export function headerWorldLabel(active: string, language: SiteLanguage) {
  const id = active === "activities" ? "attractions" : active;
  if (id === "corporate") return { he: "לעסקים", en: "Business", fr: "Entreprises", ru: "Бизнес" }[language];
  return headerWorldOptions(language).find((world) => world.id === id)?.label || labels[language][0];
}

export function headerWorldCompactLabel(active: string, language: SiteLanguage) {
  const id = active === "activities" ? "attractions" : active;
  const index = order.indexOf(id as typeof order[number]);
  const compact = {
    he: ["נופש", "ספא", "אירועים", "לפי שעה", "אטרקציות", "טיולים", "ספקים", "לעסקים", "גיפט"],
    en: ["Stays", "Spa", "Events", "Hourly", "Attractions", "Trails", "Services", "Business", "Gift"],
    fr: ["Séjours", "Spa", "Fêtes", "À l’heure", "Loisirs", "Balades", "Services", "Entreprises", "Cadeau"],
    ru: ["Отдых", "Спа", "События", "По часам", "Досуг", "Туры", "Услуги", "Бизнес", "Подарок"],
  } as const;
  return compact[language][index < 0 ? 0 : index];
}
