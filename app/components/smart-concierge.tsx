"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

type Reply = { text: string; href?: string; label?: string };

function answer(value: string): Reply {
  const text = value.toLowerCase();
  if (/אירוע|מסיבה|יום הולדת/.test(text)) return { text: "אפשר לחפש מתחם לפי אזור, תאריך וכמות משתתפים.", href: "/events/", label: "חיפוש מקומות לאירועים" };
  if (/ספא|עיסוי|טיפול/.test(text)) return { text: "ריכזתי עבורכם את עולם הספא והטיפולים.", href: "/spas/", label: "למתחמי הספא" };
  if (/טיול|מסלול|טבע|נחל/.test(text)) return { text: "יש לנו מסלולים עצמאיים עם קושי, זמן ומקור רשמי לבדיקה.", href: "/trails/", label: "למסלולי הטיול" };
  if (/שעה|כמה שעות/.test(text)) return { text: "אפשר לעבור ישר לחדרים שמוצעים לשהייה קצרה.", href: "/hourly/", label: "לחדרים לפי שעה" };
  return { text: "אפשר להתחיל בחיפוש נופש ולסנן לפי אזור, הרכב ומאפייני המקום.", href: "/search/", label: "לחיפוש החופשה" };
}

export function SmartConcierge() {
  const [open, setOpen] = useState(false);
  const [reply, setReply] = useState<Reply | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const field = new FormData(form).get("question")?.toString().trim();
    if (!field) return;
    setReply(answer(field));
    form.reset();
  }

  return <aside className={`smart-concierge ${open ? "open" : ""}`} aria-label="העוזר החכם של האתר">
    {open ? <section className="smart-concierge__panel" role="dialog" aria-modal="false" aria-labelledby="smart-concierge-title">
      <header><div><span aria-hidden="true">VII</span><div><strong id="smart-concierge-title">העוזר של וי</strong><small>המחשה פעילה באתר</small></div></div><button type="button" onClick={() => setOpen(false)} aria-label="סגירת העוזר">סגירה</button></header>
      <div className="smart-concierge__messages"><p>היי, ספרו לי מה אתם מחפשים ואכוון אתכם לעולם המתאים באתר.</p>{reply ? <div><p>{reply.text}</p>{reply.href ? <Link href={reply.href}>{reply.label}</Link> : null}</div> : null}</div>
      <div className="smart-concierge__suggestions">{["וילה למשפחה", "מקום ליום הולדת", "מסלול בטבע"].map((label) => <button key={label} type="button" onClick={() => setReply(answer(label))}>{label}</button>)}</div>
      <form onSubmit={submit}><label className="sr-only" htmlFor="concierge-question">מה תרצו למצוא?</label><input id="concierge-question" name="question" placeholder="מה תרצו למצוא?" autoComplete="off" /><button type="submit">שליחה</button></form>
      <footer>העוזר פועל כרגע כהמחשה מקומית ואינו שולח הודעות לוואטסאפ או לשירות חיצוני.</footer>
    </section> : null}
    <button className="smart-concierge__trigger" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}><span>עוזר חכם</span><b>שאלו אותי</b></button>
  </aside>;
}
