import type { SiteLanguage } from "./locale-routing";

export const eventSlotCopy: Record<SiteLanguage, { label: string; both: string; morning: string; evening: string }> = {
  he: { label: "מועד האירוע", both: "בוקר או ערב", morning: "בוקר", evening: "ערב" },
  en: { label: "Event time", both: "Morning or evening", morning: "Morning", evening: "Evening" },
  ru: { label: "Время мероприятия", both: "Утро или вечер", morning: "Утро", evening: "Вечер" },
  fr: { label: "Créneau de l’événement", both: "Matin ou soir", morning: "Matin", evening: "Soir" },
};
