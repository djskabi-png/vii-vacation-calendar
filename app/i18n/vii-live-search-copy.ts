import type { SiteLanguage } from "./locale-routing";

export const unknownReviewer = "אורח";

export const eventLiveCopy: Record<SiteLanguage, {
  checking: string;
  error: string;
  unavailable: string;
  unknown: string;
  duration: string;
  hours: (count: number) => string;
  available: (total: number, count: number, date: string, start: string) => string;
}> = {
  he: {
    checking: "בודקים זמינות ומחיר", error: "לא ניתן לאמת זמינות כרגע", unavailable: "אין זמינות במועד שבחרתם",
    unknown: "אין מידע מאומת על זמינות למועד זה", duration: "משך האירוע", hours: (count) => `${count} שעות`,
    available: (total, count, date, start) => `פנוי מ־${total.toLocaleString("he-IL")} ₪ ל־${count} שעות · ${date} ${start}`,
  },
  en: {
    checking: "Checking availability and price", error: "Availability could not be verified", unavailable: "Unavailable for your dates",
    unknown: "No verified availability for this date", duration: "Event duration", hours: (count) => `${count} hours`,
    available: (total, count, date, start) => `Available from ILS ${total.toLocaleString("en-US")} for ${count} hours · ${date} ${start}`,
  },
  ru: {
    checking: "Проверяем наличие и цену", error: "Не удалось проверить наличие", unavailable: "Нет мест на выбранную дату",
    unknown: "Нет подтвержденных данных на эту дату", duration: "Длительность мероприятия", hours: (count) => `${count} ч`,
    available: (total, count, date, start) => `Свободно от ${total.toLocaleString("ru-RU")} ₪ за ${count} ч · ${date} ${start}`,
  },
  fr: {
    checking: "Vérification des disponibilités et du prix", error: "Disponibilité impossible à vérifier", unavailable: "Indisponible aux dates choisies",
    unknown: "Aucune disponibilité vérifiée pour cette date", duration: "Durée de l’événement", hours: (count) => `${count} heures`,
    available: (total, count, date, start) => `Disponible dès ${total.toLocaleString("fr-FR")} ₪ pour ${count} heures · ${date} ${start}`,
  },
};
