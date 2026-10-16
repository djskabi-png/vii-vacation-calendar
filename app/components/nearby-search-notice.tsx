"use client";
import { useSiteLanguage } from "../i18n/locale-provider";
import { nearbyRecommendationCopy } from "../lib/nearby-recommendations";

export function NearbySearchNotice({ regionalOnly = false, dated = false }: { regionalOnly?: boolean; dated?: boolean }) {
  const { language } = useSiteLanguage();
  const copy = nearbyRecommendationCopy[language];
  const labels = {
    he: { title: "הוספנו אפשרויות מהסביבה", date: "במקומות שלא אושרו כפנויים יש לבדוק את הזמינות לתאריכים שבחרתם." },
    en: { title: "More options in the surrounding area", date: "Check your selected dates with any place whose availability has not been confirmed." },
    ru: { title: "Дополнительные варианты в окрестностях", date: "Уточните выбранные даты у мест, доступность которых ещё не подтверждена." },
    fr: { title: "D'autres choix dans les environs", date: "Vérifiez les dates choisies auprès des lieux dont la disponibilité n'a pas été confirmée." },
  }[language];
  return <div className="availability-demo-summary availability-demo-summary--live" role="status">
    <strong>{labels.title}</strong><span>{copy.expanded} {regionalOnly ? copy.regional : copy.places}</span>
    {dated && <small>{labels.date}</small>}
  </div>;
}
