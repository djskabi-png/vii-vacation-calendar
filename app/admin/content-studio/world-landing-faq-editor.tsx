"use client";

import { decodeWorldLandingFaq, type WorldLandingFaq } from "../../lib/world-landing-faq";

export function WorldLandingFaqEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const rows = decodeWorldLandingFaq(value);
  if (!rows) return <p role="alert">לא הצלחנו לטעון את השאלות לעריכה. התוכן השמור נשמר.</p>;
  function update(index: number, field: keyof WorldLandingFaq, text: string) {
    onChange(JSON.stringify(rows!.map((row, current) => current === index ? { ...row, [field]: text } : row)));
  }
  return <fieldset>
    <legend>שאלות נפוצות בעמודי החדרים לפי שעה</legend>
    <p>השאלות נשמרות עם גרסת התוכן והשפה שנבחרה. פרסום הגרסה מעדכן את האתר.</p>
    {rows.map((row, index) => <div key={index}>
      <label><span>שאלה {index + 1}</span><input value={row.question} maxLength={180} onChange={event => update(index, "question", event.target.value)} /></label>
      <label><span>תשובה</span><textarea value={row.answer} maxLength={600} rows={3} onChange={event => update(index, "answer", event.target.value)} /></label>
      <button type="button" className="button subtle" aria-label={`מחיקת שאלה ${index + 1}`} onClick={() => onChange(JSON.stringify(rows.filter((_, current) => current !== index)))}>מחיקת שאלה</button>
    </div>)}
    <button type="button" className="button secondary" disabled={rows.length >= 8} onClick={() => onChange(JSON.stringify([...rows, { question: "", answer: "" }]))}>הוספת שאלה</button>
  </fieldset>;
}
