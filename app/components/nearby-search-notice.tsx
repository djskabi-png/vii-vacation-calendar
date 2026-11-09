"use client";
import { useSiteLanguage } from "../i18n/locale-provider";

export function NearbySearchNotice({ regionalOnly = false, dated = false }: { regionalOnly?: boolean; dated?: boolean }) {
  const { language } = useSiteLanguage();
  const labels = {
    he: { title: "מקומות נוספים באזור", regional: "מוצגות גם אפשרויות מהאזור הרחב יותר.", places: "מוצגות גם אפשרויות בסביבה לפי מיקום משוער.", date: "במקומות שלא אושרו כפנויים יש לבדוק את הזמינות לתאריכים שבחרתם." },
    en: { title: "More places nearby", regional: "Includes options from the wider region.", places: "Includes nearby options based on approximate location.", date: "Check your selected dates with any place whose availability has not been confirmed." },
    ru: { title: "Другие места поблизости", regional: "Включены варианты из более широкого региона.", places: "Ближайшие варианты по приблизительному расположению.", date: "Уточните выбранные даты у мест, доступность которых ещё не подтверждена." },
    fr: { title: "D’autres lieux à proximité", regional: "Des options de la région élargie sont incluses.", places: "Des options proches selon une localisation approximative.", date: "Vérifiez les dates choisies auprès des lieux dont la disponibilité n'a pas été confirmée." },
  }[language];
  return <div className="nearby-search-notice" role="status">
    <strong>{labels.title}</strong><span>{regionalOnly ? labels.regional : labels.places}</span>
    {dated && <small>{labels.date}</small>}
  </div>;
}
