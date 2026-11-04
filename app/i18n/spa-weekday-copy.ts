import type { SiteLanguage } from "./locale-routing";
import { spaWeekdayLabels, type SpaWeekdaySlug } from "../lib/spa-weekday-pages";

export function weekdayCopy(weekday: SpaWeekdaySlug, language: SiteLanguage) {
  const day = spaWeekdayLabels[language][weekday];
  const hebrewPeriod = weekday === "saturday" ? "שבת הקרובה" : `${day} הקרוב`;
  const copies = {
    he: {
      title: `ספא ל${hebrewPeriod}`,
      description: `מחפשים ספא פנוי ל${hebrewPeriod}? השוו חבילות ליחיד, לזוג ולקבוצה ובדקו את המחיר והזמינות לפני אישור ההזמנה.`,
      eyebrow: "מתכננים יום ספא", results: `חבילות ספא ל${hebrewPeriod}`, faqTitle: "לפני שבוחרים חבילה",
      faq: [
        { question: "לאיזה תאריך מתייחס העמוד?", answer: `העמוד מציג את המופע הבא של ${day}. בשעה 14:00 לפי שעון ישראל היום הנוכחי יוצא מחיפושי הרגע האחרון; אם זהו היום שבחרתם, העמוד מתקדם לאותו יום בשבוע הבא. התאריך מוצג ליד החבילות.` },
        { question: "האם החבילות שמופיעות זמינות להזמנה?", answer: "כאשר הזמינות אומתה, החבילות מוצגות לפי נתוני הספק לתאריך הנבחר. אם הבדיקה עדיין מתבצעת, מוצגת הודעה מתאימה. המחיר ושעת הטיפול נבדקים שוב לפני אישור ההזמנה." },
        { question: "אפשר לבחור חבילה זוגית או לקבוצה?", answer: "כן. בחרו יחיד, זוג או קבוצה כדי לראות חבילות שמתאימות להרכב. יש לבדוק בכל חבילה את מספר המשתתפים, הטיפולים והמתקנים הכלולים." },
      ],
    },
    en: {
      title: `Spa packages for the next ${day}`,
      description: `Looking for an available spa package for the next ${day}? Compare solo, couple and group packages, then check the price and availability before confirming.`,
      eyebrow: "Plan your spa visit", results: `Spa packages for ${day}`, faqTitle: "Before choosing a package",
      faq: [
        { question: "Which date does this page show?", answer: `This page follows the next ${day}. At 14:00 Israel time, today leaves last-minute discovery. If today is the selected weekday, the page advances to that weekday next week. Each package shows its date.` },
        { question: "Are the displayed packages available to book?", answer: "Verified availability comes from the supplier for the selected date. A notice appears while availability is still being checked. The price and treatment time are checked again before confirmation." },
        { question: "Can I choose a couple or group package?", answer: "Yes. Choose solo, couple or group to see matching packages. Check the number of guests, treatments and facilities included in each package." },
      ],
    },
    ru: {
      title: `Спа-пакеты: ${day.toLocaleLowerCase("ru")}`,
      description: "Выберите спа-пакет на ближайший указанный день недели: для одного, пары или группы. Цена и наличие мест проверяются перед подтверждением бронирования.",
      eyebrow: "Планируем день в спа", results: `Спа-пакеты: ${day.toLocaleLowerCase("ru")}`, faqTitle: "Перед выбором пакета",
      faq: [
        { question: "На какую дату рассчитана эта страница?", answer: `Выбранный день недели: ${day.toLocaleLowerCase("ru")}. В 14:00 по израильскому времени текущий день исключается из поиска ближайших предложений. Если выбран именно он, дата переносится на следующую неделю. Дата указана рядом с пакетами.` },
        { question: "Можно ли забронировать все показанные пакеты?", answer: "Подтверждённое наличие мест поступает от поставщика на выбранную дату. Пока идёт проверка, появляется соответствующее уведомление. Цена и время процедуры проверяются повторно перед подтверждением." },
        { question: "Есть ли пакеты для пары или группы?", answer: "Да. Выберите вариант для одного, пары или группы. В каждом пакете проверьте число участников, процедуры и включённые удобства." },
      ],
    },
    fr: {
      title: `Forfaits spa pour ${day.toLocaleLowerCase("fr")} prochain`,
      description: `Vous cherchez un forfait spa pour ${day.toLocaleLowerCase("fr")} prochain ? Comparez les offres pour une personne, un couple ou un groupe avant de vérifier le prix et la disponibilité.`,
      eyebrow: "Préparez votre journée au spa", results: `Forfaits spa du ${day.toLocaleLowerCase("fr")}`, faqTitle: "Avant de choisir votre forfait",
      faq: [
        { question: "À quelle date cette page correspond-elle ?", answer: `Cette page suit le prochain ${day.toLocaleLowerCase("fr")}. À 14 h, heure d'Israël, le jour en cours est retiré des offres de dernière minute. Si c'est le jour sélectionné, la page passe au même jour de la semaine suivante. La date figure près des forfaits.` },
        { question: "Les forfaits affichés sont-ils disponibles à la réservation ?", answer: "La disponibilité confirmée provient du prestataire pour la date choisie. Un message s'affiche pendant la vérification. Le prix et l'heure du soin sont à nouveau vérifiés avant confirmation." },
        { question: "Puis-je choisir une offre pour un couple ou un groupe ?", answer: "Oui. Choisissez une personne, un couple ou un groupe. Vérifiez le nombre de participants, les soins et les installations inclus dans chaque forfait." },
      ],
    },
  };
  return copies[language];
}
