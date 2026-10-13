"use client";

import { useSiteLanguage } from "../../i18n/locale-provider";

const copy = {
  he: { title: "מכינים לכם את המקומות באזור", text: "עוד רגע אפשר להתחיל להשוות." },
  en: { title: "Preparing places in this area", text: "You’ll be able to compare them in a moment." },
  ru: { title: "Подбираем места в этом районе", text: "Через мгновение можно будет сравнить варианты." },
  fr: { title: "Préparation des lieux dans cette région", text: "Vous pourrez les comparer dans un instant." },
} as const;

export default function VacationRegionLoading() {
  const { language } = useSiteLanguage();
  const text = copy[language];
  return <main id="main-content" className="vacation-route-loading" aria-busy="true" aria-live="polite">
    <div className="vacation-route-loading__mark" aria-hidden="true"><span /><span /><span /></div>
    <h2>{text.title}</h2>
    <p>{text.text}</p>
    <div className="vacation-route-loading__cards" aria-hidden="true">
      <span /><span /><span />
    </div>
  </main>;
}
