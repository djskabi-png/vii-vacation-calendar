"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { CalendarIcon } from "../site-header";
import { saveBooking } from "../lib/account";
import { SpaAppointmentPicker } from "../components/spa-appointment-picker";

type Props = {
  world: string;
  placeId: string;
  placeName: string;
  offerId: string;
  offerName: string;
  price: string;
  action: string;
  initialFrom?: string;
  initialTill?: string;
  initialGuests?: string;
};

export default function BookingPageClient(props: Props) {
  const [state, setState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [reference, setReference] = useState("");
  const [submissionId, setSubmissionId] = useState("");
  const [spaAppointmentReady, setSpaAppointmentReady] = useState(false);
  const isManage = props.action === "manage";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "submitting" || state === "success") return;
    setState("submitting");
    const values = new FormData(event.currentTarget);
    const id = submissionId || crypto.randomUUID();
    if (!submissionId) setSubmissionId(id);
    const details = [
      `מקום או ספק: ${props.placeName}`,
      `שירות או חבילה: ${props.offerName}`,
      values.get("date") ? `תאריך: ${values.get("date")}` : "",
      values.get("till") ? `תאריך עזיבה: ${values.get("till")}` : "",
      values.get("time") ? `שעה: ${values.get("time")}` : "",
      values.get("guests") ? `כמות משתתפים: ${values.get("guests")}` : "",
      values.get("notes") ? `הערות: ${values.get("notes")}` : "",
    ].filter(Boolean).join("\n");

    try {
      const response = await fetch("/api/leads/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: id,
          purpose: isManage ? "booking-management" : "booking",
          world: props.world,
          name: values.get("name"),
          phone: values.get("phone"),
          email: values.get("email"),
          organization: props.placeName,
          package: props.offerId || undefined,
          message: details,
          honey: values.get("company_site"),
          privacyAccepted: values.get("privacy") === "on",
          sourcePage: window.location.href,
        }),
      });
      const result = await response.json() as { success?: boolean; reference?: string };
      if (!response.ok || !result.success) throw new Error("booking failed");
      if (!isManage) saveBooking({ id, reference: result.reference, world: props.world, placeName: props.placeName, offerName: props.offerName, date: [values.get("date"), values.get("till")].filter(Boolean).join(" עד "), guests: String(values.get("guests") || ""), status: "pending", createdAt: new Date().toISOString() });
      setReference(result.reference || "");
      setState("success");
    } catch {
      setState("error");
    }
  }

  if (state === "success") return <main id="main-content" className="booking-page shell">
    <section className="booking-success" role="status" aria-live="polite">
      <span aria-hidden="true">✓</span>
      <h1>{isManage ? "בקשת השינוי התקבלה" : "ההזמנה נקלטה"}</h1>
      <p>{isManage ? "הבקשה נשמרה במערכת ונציג יבדוק אותה." : "בקשת ההזמנה נשמרה. נציג יאמת את הזמינות והמחיר לפני אישור סופי או חיוב."}</p>
      {reference ? <strong dir="ltr">{reference}</strong> : null}
      <div className="booking-success__actions"><Link className="button primary" href="/account">לצפייה בהזמנות שלי</Link><Link className="button secondary" href="/">חזרה לדף הבית</Link></div>
    </section>
  </main>;

  return <main id="main-content" className="booking-page shell">
    <div className="booking-page__intro">
      <span className="eyebrow">{isManage ? "ניהול הזמנה" : "הזמנה אונליין באתר"}</span>
      <h1>{isManage ? "עדכון או ביטול הזמנה" : props.placeName}</h1>
      <p>{isManage ? "מוסרים את מספר ההזמנה והבקשה המבוקשת. הבקשה נכנסת ישירות למערכת ההזמנות." : "בוחרים מועד והרכב ושולחים הזמנה. אין מעבר לאתר חיצוני ואין חיוב לפני שהמחיר והזמינות אושרו."}</p>
    </div>

    <div className="booking-flow">
      <aside className="booking-summary">
        <CalendarIcon />
        <small>{isManage ? "פרטי ההזמנה" : "מה מזמינים"}</small>
        <h2>{props.offerName}</h2>
        <strong>{props.placeName}</strong>
        <p>{props.price}</p>
        <ul><li>הפרטים נשמרים במערכת של האתר</li><li>המחיר הסופי מוצג לפני חיוב</li><li>האישור מתקבל לאחר בדיקת זמינות</li></ul>
      </aside>

      <form className="booking-form" onSubmit={submit}>
        {isManage ? <label className="form-wide">מספר הזמנה<input name="bookingReference" required /></label> : <>
          {props.world === "spa" ? <SpaAppointmentPicker initialDate={props.initialFrom} onSelectionChange={setSpaAppointmentReady} /> : <label>תאריך הגעה<input name="date" type="date" defaultValue={props.initialFrom} required /></label>}
          {props.world === "vacation" ? <label>תאריך עזיבה<input name="till" type="date" defaultValue={props.initialTill} required /></label> : null}
          {props.world !== "spa" ? <label>שעה מועדפת<input name="time" type="time" /></label> : null}
          <label>כמות אורחים או משתתפים<input name="guests" type="number" min="1" defaultValue={props.initialGuests || "2"} required /></label>
        </>}
        <label>שם מלא<input name="name" autoComplete="name" minLength={2} required /></label>
        <label>טלפון<input name="phone" type="tel" inputMode="tel" autoComplete="tel" minLength={7} required /></label>
        <label>דואר אלקטרוני<input name="email" type="email" autoComplete="email" /></label>
        <label className="form-wide">{isManage ? "מה תרצו לעדכן?" : "בקשות מיוחדות"}<textarea name="notes" rows={4} maxLength={1500} /></label>
        <label className="form-honey" aria-hidden="true">אתר החברה<input name="company_site" tabIndex={-1} autoComplete="off" /></label>
        <label className="consent legal-consent form-wide"><input name="privacy" type="checkbox" required /><span>קראתי והסכמתי ל<Link href="/legal/terms">תקנון האתר</Link> ול<Link href="/legal/privacy">מדיניות הפרטיות</Link>, ואני מאשר או מאשרת שימוש בפרטים לצורך הטיפול בהזמנה.</span></label>
        <button className="button primary form-wide" disabled={state === "submitting" || (!isManage && props.world === "spa" && !spaAppointmentReady)} type="submit">{state === "submitting" ? "שולחים..." : isManage ? "שליחת בקשת שינוי" : "שליחת בקשת הזמנה"}</button>
        {!isManage && props.world === "spa" && !spaAppointmentReady ? <p className="booking-form__hint form-wide" role="status">בחרו תאריך ושעה כדי להמשיך להזמנה.</p> : null}
        {state === "error" ? <p className="form-error form-wide" role="alert">השליחה לא הושלמה. הפרטים נשארו בטופס ואפשר לנסות שוב.</p> : null}
      </form>
    </div>
  </main>;
}
