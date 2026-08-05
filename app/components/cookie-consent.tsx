"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "vii-cookie-choice";
const OPEN_EVENT = "vii-open-cookie-settings";
const SETTINGS_HASH = "#privacy-settings";

export function CookieConsent() {
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
    <aside id="privacy-settings" className="cookie-card" aria-label="העדפות פרטיות">
      <div><strong>הפרטיות שלכם חשובה</strong><p>קבצים חיוניים שומרים על תפקוד האתר. כלים נוספים יופעלו רק לפי הבחירה שלכם.</p></div>
      {settings && (
        <div className="cookie-settings">
          <label><input type="checkbox" checked disabled /> <span><strong>קבצים חיוניים</strong><small>נדרשים לתפקוד תקין של האתר.</small></span></label>
          <label><input type="checkbox" checked={analytics} onChange={(event) => setAnalytics(event.target.checked)} /> <span><strong>מדידה ושיפור</strong><small>מסייעים להבין כיצד משפרים את חוויית הגלישה.</small></span></label>
        </div>
      )}
      <div className="cookie-actions">
        {settings ? (
          <button type="button" className="button primary" onClick={() => choose(analytics ? "all" : "essential")}>שמירת הבחירה</button>
        ) : (
          <button type="button" className="button primary" onClick={() => choose("all")}>אישור הכל</button>
        )}
        <button type="button" className="button subtle" onClick={() => choose("essential")}>חיוניים בלבד</button>
        <button type="button" className="text-button" aria-expanded={settings} onClick={() => setSettings((value) => !value)}>{settings ? "חזרה" : "העדפות"}</button>
      </div>
    </aside>
  );
}

export function CookiePreferencesButton() {
  return <a className="footer-privacy-button" href={SETTINGS_HASH}>העדפות פרטיות</a>;
}
