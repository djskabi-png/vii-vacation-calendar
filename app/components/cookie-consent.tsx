"use client";

import { useEffect, useState } from "react";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [settings, setSettings] = useState(false);
  useEffect(() => { const timer = window.setTimeout(() => setVisible(!localStorage.getItem("vii-cookie-choice")), 0); return () => window.clearTimeout(timer); }, []);
  function choose(value: "all" | "essential") {
    localStorage.setItem("vii-cookie-choice", value);
    setVisible(false);
  }
  if (!visible) return null;
  return (
    <aside className="cookie-card" aria-label="העדפות פרטיות">
      <div><strong>הפרטיות שלכם חשובה</strong><p>קבצים חיוניים שומרים על תפקוד האתר. כלים נוספים יופעלו רק לפי הבחירה שלכם.</p></div>
      {settings && <label><input type="checkbox" checked disabled /> קבצים חיוניים</label>}
      <div className="cookie-actions">
        <button type="button" className="button primary" onClick={() => choose("all")}>אישור הכל</button>
        <button type="button" className="button subtle" onClick={() => choose("essential")}>חיוניים בלבד</button>
        <button type="button" className="text-button" onClick={() => setSettings((value) => !value)}>העדפות</button>
      </div>
    </aside>
  );
}
