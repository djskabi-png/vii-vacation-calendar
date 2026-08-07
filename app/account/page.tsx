"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageShell } from "../components/page-shell";
import { ACCOUNT_EVENT, readAccount, readBookings, saveAccount, type BookingRecord, type LocalAccount } from "../lib/account";
import { readSavedItems, SAVED_ITEMS_EVENT } from "../lib/saved-items";

const worldLabels: Record<string, string> = { vacation: "נופש", events: "אירועים", spa: "ספא", hourly: "חדרים לפי שעה", providers: "ספקים", activities: "אטרקציות" };

export default function AccountPage() {
  const [account, setAccount] = useState<LocalAccount | null>(null);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [savedCount, setSavedCount] = useState(0);
  const [authProvider, setAuthProvider] = useState<"google" | "facebook" | null>(null);

  useEffect(() => {
    const sync = () => { const nextAccount = readAccount(); setAccount(nextAccount); if (!nextAccount) setAuthProvider(null); setBookings(readBookings()); setSavedCount(readSavedItems().length); };
    const timer = window.setTimeout(sync, 0);
    window.addEventListener(ACCOUNT_EVENT, sync);
    window.addEventListener(SAVED_ITEMS_EVENT, sync);
    return () => { window.clearTimeout(timer); window.removeEventListener(ACCOUNT_EVENT, sync); window.removeEventListener(SAVED_ITEMS_EVENT, sync); };
  }, []);

  function login(provider: "google" | "facebook") {
    setAuthProvider(provider);
    window.setTimeout(() => saveAccount({ name: "אורח VII", email: `demo-${provider}@vii.co.il`, createdAt: new Date().toISOString() }), 650);
  }

  if (!account) return <PageShell showWorldSwitcher={false}><main id="main-content" className="account-page"><section className="account-login shell"><div className="account-login__intro"><span className="eyebrow">החוויה שלכם ממשיכה כאן</span><h1>החשבון האישי שלי</h1><p>שומרים מקומות מכל עולמות האתר, עוקבים אחר הזמנות וחוזרים בדיוק לנקודה שבה עצרתם.</p><ul><li>כל האהובים במקום אחד</li><li>הזמנות ומספרי אישור</li><li>פרטים שמורים להזמנה מהירה</li></ul></div><section className="account-login__auth-card" aria-labelledby="account-login-title"><span className="account-avatar" aria-hidden="true">VII</span><h2 id="account-login-title">כניסה או פתיחת חשבון</h2><p>מתחברים בדרך שנוחה לכם וממשיכים מיד לאזור האישי.</p><div className="social-auth-actions"><button type="button" disabled={authProvider !== null} aria-busy={authProvider === "google"} onClick={() => login("google")}><span className="social-auth-icon social-auth-icon--google" aria-hidden="true">G</span><strong>{authProvider === "google" ? "מתחברים..." : "המשך עם Google"}</strong></button><button type="button" disabled={authProvider !== null} aria-busy={authProvider === "facebook"} onClick={() => login("facebook")}><span className="social-auth-icon social-auth-icon--facebook" aria-hidden="true">f</span><strong>{authProvider === "facebook" ? "מתחברים..." : "המשך עם Facebook"}</strong></button></div><small>בגרסת הפיתוח הכפתורים מדגימים את זרימת הכניסה. צוות הפיתוח יחבר אימות מאובטח וסנכרון מלא בין מכשירים.</small></section></section></main></PageShell>;

  return <PageShell showWorldSwitcher={false}><main id="main-content" className="account-page"><section className="account-dashboard-hero"><div className="shell"><div><span className="eyebrow">האזור האישי</span><h1>שלום {account.name}</h1><p>כל הבחירות וההזמנות שלכם מסודרות ומוכנות להמשך.</p></div><button type="button" onClick={() => saveAccount(null)}>יציאה מהחשבון</button></div></section><section className="account-dashboard shell"><div className="account-stats"><Link href="/favorites"><strong>{savedCount}</strong><span>פריטים שאהבתי</span><small>לכל השמירות</small></Link><a href="#bookings"><strong>{bookings.length}</strong><span>הזמנות ובקשות</span><small>למעקב הזמנות</small></a><article><strong>{account.name.slice(0, 1)}</strong><span>הפרופיל שלי</span><small>{account.email}</small></article></div><section id="bookings" className="account-bookings"><div className="section-head"><div><span className="eyebrow">נשארים מעודכנים</span><h2>ההזמנות שלי</h2></div><Link className="button secondary" href="/">הזמנה חדשה</Link></div>{bookings.length ? <div className="account-booking-list">{bookings.map((booking) => <article key={booking.id}><div><small>{worldLabels[booking.world] || "הזמנה"}</small><h3>{booking.placeName}</h3><p>{booking.offerName}</p></div><dl>{booking.date ? <div><dt>תאריך</dt><dd>{booking.date}</dd></div> : null}{booking.guests ? <div><dt>כמות</dt><dd>{booking.guests}</dd></div> : null}<div><dt>סטטוס</dt><dd>ממתינה לאישור</dd></div></dl><div>{booking.reference ? <strong dir="ltr">{booking.reference}</strong> : null}<Link href={`/booking?action=manage${booking.reference ? `&reference=${encodeURIComponent(booking.reference)}` : ""}`}>ניהול הזמנה</Link></div></article>)}</div> : <div className="account-empty"><h3>עדיין אין הזמנות בחשבון</h3><p>אחרי שתשלחו הזמנה היא תופיע כאן עם הסטטוס ומספר האישור.</p><Link className="button primary" href="/">מתחילים לבחור</Link></div>}</section><section className="account-profile"><div><span className="eyebrow">הפרטים שלי</span><h2>פרטי החשבון</h2></div><dl><div><dt>שם</dt><dd>{account.name}</dd></div><div><dt>דואר אלקטרוני</dt><dd dir="ltr">{account.email}</dd></div>{account.phone ? <div><dt>טלפון</dt><dd dir="ltr">{account.phone}</dd></div> : null}</dl></section></section></main></PageShell>;
}
