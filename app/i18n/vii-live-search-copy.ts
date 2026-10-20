import type { SiteLanguage } from "./locale-routing";

export const unknownReviewer = "אורח";

export const eventLiveCopy: Record<SiteLanguage, {
  checking: string;
  error: string;
  unavailable: string;
  availableNoPrice: string;
  unknown: string;
  duration: string;
  hours: (count: number) => string;
  available: (total: number, count: number, date: string, start: string) => string;
}> = {
  he: {
    checking: "בודקים זמינות ומחיר", error: "לא ניתן לאמת זמינות כרגע", unavailable: "אין זמינות במועד שבחרתם", availableNoPrice: "פנוי במועד שבחרתם",
    unknown: "אין מידע מאומת על זמינות למועד זה", duration: "משך האירוע", hours: (count) => `${count} שעות`,
    available: (total, _count, date, _start) => `פנוי · ${total.toLocaleString("he-IL")} ₪ לאירוע · ${date}`,
  },
  en: {
    checking: "Checking availability and price", error: "Availability could not be verified", unavailable: "Unavailable for your dates", availableNoPrice: "Available for your selected date",
    unknown: "No verified availability for this date", duration: "Event duration", hours: (count) => `${count} hours`,
    available: (total, _count, date, _start) => `Available · ₪${total.toLocaleString("en-US")} for the event · ${date}`,
  },
  ru: {
    checking: "Проверяем наличие и цену", error: "Не удалось проверить наличие", unavailable: "Нет мест на выбранную дату", availableNoPrice: "Свободно на выбранную дату",
    unknown: "Нет подтвержденных данных на эту дату", duration: "Длительность мероприятия", hours: (count) => `${count} ч`,
    available: (total, _count, date, _start) => `Свободно · ${total.toLocaleString("ru-RU")} ₪ за мероприятие · ${date}`,
  },
  fr: {
    checking: "Vérification des disponibilités et du prix", error: "Disponibilité impossible à vérifier", unavailable: "Indisponible aux dates choisies", availableNoPrice: "Disponible à la date choisie",
    unknown: "Aucune disponibilité vérifiée pour cette date", duration: "Durée de l’événement", hours: (count) => `${count} heures`,
    available: (total, _count, date, _start) => `Disponible · ${total.toLocaleString("fr-FR")} ₪ pour l’événement · ${date}`,
  },
};
