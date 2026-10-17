import type { SiteLanguage } from "./locale-routing";

export const eventSlotCopy: Record<SiteLanguage, { label: string; both: string; morning: string; evening: string }> = {
  he: { label: "מועד האירוע", both: "בוקר או ערב", morning: "בוקר · 08:00 עד 16:00", evening: "ערב · 17:00 עד חצות" },
  en: { label: "Event time", both: "Morning or evening", morning: "Morning · 08:00 to 16:00", evening: "Evening · 17:00 to midnight" },
  ru: { label: "Время мероприятия", both: "Утро или вечер", morning: "Утро · с 08:00 до 16:00", evening: "Вечер · с 17:00 до полуночи" },
  fr: { label: "Créneau de l’événement", both: "Matin ou soir", morning: "Matin · de 08:00 à 16:00", evening: "Soir · de 17:00 à minuit" },
};
