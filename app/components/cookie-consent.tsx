"use client";

import { useEffect, useState } from "react";
import { useSiteLanguage, type SiteLanguage } from "../i18n/locale-provider";

const STORAGE_KEY = "vii-cookie-choice";
const OPEN_EVENT = "vii-open-cookie-settings";
const SETTINGS_HASH = "#privacy-settings";

const copy: Record<SiteLanguage, {
  aria: string;
  title: string;
  description: string;
  essentialTitle: string;
  essentialDescription: string;
  analyticsTitle: string;
  analyticsDescription: string;
  save: string;
  allowAll: string;
  essentialsOnly: string;
  back: string;
  preferences: string;
}> = {
  he: {
    aria: "העדפות פרטיות", title: "הפרטיות שלכם חשובה",
    description: "קבצים חיוניים שומרים על תפקוד האתר. כלים נוספים יופעלו רק לפי הבחירה שלכם.",
    essentialTitle: "קבצים חיוניים", essentialDescription: "נדרשים לתפקוד תקין של האתר.",
    analyticsTitle: "מדידה ושיפור", analyticsDescription: "מסייעים להבין כיצד משפרים את חוויית הגלישה.",
    save: "שמירת הבחירה", allowAll: "אישור הכל", essentialsOnly: "חיוניים בלבד", back: "חזרה", preferences: "העדפות",
  },
  en: {
    aria: "Privacy preferences", title: "Your privacy matters",
    description: "Essential cookies keep the site working. Optional tools are enabled only with your permission.",
    essentialTitle: "Essential cookies", essentialDescription: "Required for the site to work properly.",
    analyticsTitle: "Analytics and improvement", analyticsDescription: "Help us understand how to improve your browsing experience.",
    save: "Save my choice", allowAll: "Allow all", essentialsOnly: "Essentials only", back: "Back", preferences: "Preferences",
  },
  ru: {
    aria: "Настройки конфиденциальности", title: "Ваша конфиденциальность важна",
    description: "Необходимые файлы cookie обеспечивают работу сайта. Дополнительные инструменты включаются только с вашего согласия.",
    essentialTitle: "Необходимые файлы cookie", essentialDescription: "Нужны для корректной работы сайта.",
    analyticsTitle: "Аналитика и улучшение", analyticsDescription: "Помогают нам улучшать удобство использования сайта.",
    save: "Сохранить выбор", allowAll: "Разрешить все", essentialsOnly: "Только необходимые", back: "Назад", preferences: "Настройки",
  },
  fr: {
    aria: "Préférences de confidentialité", title: "Votre vie privée compte",
    description: "Les cookies essentiels assurent le bon fonctionnement du site. Les outils facultatifs ne sont activés qu’avec votre accord.",
    essentialTitle: "Cookies essentiels", essentialDescription: "Nécessaires au bon fonctionnement du site.",
    analyticsTitle: "Mesure et amélioration", analyticsDescription: "Nous aident à améliorer votre expérience de navigation.",
    save: "Enregistrer mon choix", allowAll: "Tout autoriser", essentialsOnly: "Essentiels uniquement", back: "Retour", preferences: "Préférences",
  },
};

export function CookieConsent() {
  const { language } = useSiteLanguage();
  const labels = copy[language];
  const [visible, setVisible] = useState(false);
  const [settings, setSettings] = useState(false);
  const [analytics, setAnalytics] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const choice = localStorage.getItem(STORAGE_KEY);
      setAnalytics(choice === "all");
      setVisible(!choice);
    }, 0);

    const openSettings = () => {
      setAnalytics(localStorage.getItem(STORAGE_KEY) === "all");
      setSettings(true);
      setVisible(true);
    };

    const openFromHash = () => {
      if (window.location.hash === SETTINGS_HASH) openSettings();
    };

    window.addEventListener(OPEN_EVENT, openSettings);
    window.addEventListener("hashchange", openFromHash);
    openFromHash();
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(OPEN_EVENT, openSettings);
      window.removeEventListener("hashchange", openFromHash);
    };
  }, []);

  function choose(value: "all" | "essential") {
    localStorage.setItem(STORAGE_KEY, value);
    setAnalytics(value === "all");
    setVisible(false);
    if (window.location.hash === SETTINGS_HASH) {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }
  }

  if (!visible) return null;

  return (
    <aside id="privacy-settings" className="cookie-card" aria-label={labels.aria}>
      <div><strong>{labels.title}</strong><p>{labels.description}</p></div>
      {settings && (
        <div className="cookie-settings">
          <label><input type="checkbox" checked disabled /> <span><strong>{labels.essentialTitle}</strong><small>{labels.essentialDescription}</small></span></label>
          <label><input type="checkbox" checked={analytics} onChange={(event) => setAnalytics(event.target.checked)} /> <span><strong>{labels.analyticsTitle}</strong><small>{labels.analyticsDescription}</small></span></label>
        </div>
      )}
      <div className="cookie-actions">
        {settings ? (
          <button type="button" className="button primary" onClick={() => choose(analytics ? "all" : "essential")}>{labels.save}</button>
        ) : (
          <button type="button" className="button primary" onClick={() => choose("all")}>{labels.allowAll}</button>
        )}
        <button type="button" className="button subtle" onClick={() => choose("essential")}>{labels.essentialsOnly}</button>
        <button type="button" className="text-button" aria-expanded={settings} onClick={() => setSettings((value) => !value)}>{settings ? labels.back : labels.preferences}</button>
      </div>
    </aside>
  );
}

export function CookiePreferencesButton() {
  return <a className="footer-privacy-button" href={SETTINGS_HASH}>העדפות פרטיות</a>;
}
