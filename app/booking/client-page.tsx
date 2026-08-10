"use client";

import Link from "next/link";
import { FormEvent, useRef, useState } from "react";
import { CalendarIcon } from "../site-header";
import { saveBooking } from "../lib/account";
import { SpaAppointmentPicker } from "../components/spa-appointment-picker";

type Props = {
  world: string;
  placeId: string;
  placeName: string;
  offerId: string;
  offerName: string;
  offerAudience?: string;
  offerDuration?: string;
  offerIncludes?: string[];
  price: string;
  action: string;
  initialFrom?: string;
  initialTill?: string;
  initialGuests?: string;
  onlineReady?: boolean;
  phone?: string;
};

export default function BookingPageClient(props: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [state, setState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [reference, setReference] = useState("");
  const [submissionId, setSubmissionId] = useState("");
  const [spaAppointmentReady, setSpaAppointmentReady] = useState(false);
  const [phoneRevealed, setPhoneRevealed] = useState(false);
  const [arrival, setArrival] = useState(props.initialFrom || "");
  const [departure, setDeparture] = useState(props.initialTill || "");
  const [guests, setGuests] = useState(props.initialGuests || "2");
  const [spaComposition, setSpaComposition] = useState("");
  const [spaTime, setSpaTime] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const isManage = props.action === "manage";
  const onlineReady = props.world !== "vacation" || Boolean(props.onlineReady);

  function validateStep(currentStep: 1 | 2) {
    const section = formRef.current?.querySelector<HTMLElement>(`[data-booking-step="${currentStep}"]`);
    const controls = Array.from(section?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input, textarea, select") || []);
    const invalid = controls.find((control) => !control.checkValidity());
    if (invalid) {
      invalid.reportValidity();
      invalid.focus();
      return false;
    }
    if (currentStep === 1 && props.world === "spa" && !spaAppointmentReady) return false;
    return true;
  }

  function nextStep(currentStep: 1 | 2) {
    if (!validateStep(currentStep)) return;
    setStep(currentStep === 1 ? 2 : 3);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step !== 3 || state === "submitting" || state === "success") return;
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
      values.get("spaCompositionLabel") ? `הרכב המטופלים: ${values.get("spaCompositionLabel")}` : "",
      props.offerDuration ? `משך הטיפול: ${props.offerDuration}` : "",
      props.offerIncludes?.length ? `מה כלול: ${props.offerIncludes.join(", ")}` : "",
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

  if (!onlineReady) return <main id="main-content" className="booking-page shell">
    <section className="booking-unavailable" aria-labelledby="booking-phone-title">
      <span className="eyebrow">הזמנה בטלפון</span>
      <h1 id="booking-phone-title">חסר תאריך או מחיר להזמנה מקוונת</h1>
      <p>כדי לא להציג הזמנה חלקית, ממשיכים בשיחה ישירה עם המקום. לאחר חיבור המערכת נתוני התאריך והמחיר יגיעו אוטומטית.</p>
      {props.phone ? phoneRevealed ? <a className="phone-reveal phone-reveal--visible" href={`tel:${props.phone.replace(/[^\d+]/g, "")}`}><span>לחיוג עכשיו</span><strong dir="ltr">{props.phone}</strong></a> : <button className="phone-reveal" type="button" onClick={() => setPhoneRevealed(true)} aria-expanded={phoneRevealed}><span>טלפון להזמנה</span><strong>לחצו להצגת המספר</strong></button> : <p role="status">מספר ההזמנות טרם חובר למקום.</p>}
      <Link className="button secondary" href={`/business?id=${encodeURIComponent(props.placeId)}`}>חזרה לפרטי המקום</Link>
    </section>
  </main>;

  if (state === "success") return <main id="main-content" className="booking-page shell">
    <section className="booking-success" role="status" aria-live="polite">
      <span className="booking-success__mark" aria-hidden="true">✓</span>
      <small>{isManage ? "בקשת שינוי" : "הזמנה שממתינה לאישור"}</small>
      <h1>{isManage ? "בקשת השינוי התקבלה" : "בקשת ההזמנה נקלטה בהצלחה"}</h1>
      <p>{isManage ? "הבקשה נשמרה ונציג יבדוק אותה." : "לא בוצע חיוב. המקום יקבל את הבקשה, יאמת זמינות ומחיר ויחזיר אישור סופי."}</p>
      <div className="booking-success__summary"><strong>{props.placeName}</strong><span>{arrival}{departure ? ` עד ${departure}` : ""}</span><span>{props.world === "spa" ? `${guests} משתתפים${spaComposition ? `, ${spaComposition}` : ""}` : `${guests} אורחים`}</span><b>{props.price}</b>{reference ? <code dir="ltr">{reference}</code> : null}</div>
      <div className="booking-success__actions"><button className="button secondary" type="button" onClick={() => window.print()}>הדפסת הסיכום</button><Link className="button primary" href="/account">לצפייה בהזמנות שלי</Link><Link className="button subtle" href="/">חזרה לדף הבית</Link></div>
    </section>
  </main>;

  return <main id="main-content" className="booking-page shell">
    <div className="booking-page__intro">
      <span className="eyebrow">{isManage ? "ניהול הזמנה" : "הזמנה אונליין ללא אשראי"}</span>
      <h1>{isManage ? "עדכון או ביטול הזמנה" : props.placeName}</h1>
      <p>{isManage ? "מוסרים את מספר ההזמנה ואת הבקשה המבוקשת." : "שלושה שלבים קצרים. הבקשה נשלחת לאישור המקום ורק לאחר מכן הופכת להזמנה מאושרת."}</p>
    </div>

    <nav className="booking-steps" aria-label="שלבי ההזמנה">
      {[1, 2, 3].map((number) => <button key={number} type="button" className={step === number ? "active" : step > number ? "complete" : ""} aria-current={step === number ? "step" : undefined} onClick={() => number < step && setStep(number as 1 | 2 | 3)}><b>{number}</b><span>{number === 1 ? "פרטי השהייה" : number === 2 ? "פרטי המזמין" : "סיכום ושליחה"}</span></button>)}
    </nav>

    <div className="booking-flow booking-flow--steps">
      <aside className="booking-summary">
        <CalendarIcon />
        <small>מה מזמינים</small>
        <h2>{props.offerName}</h2>
        <strong>{props.placeName}</strong>
        <p>{props.price}</p>
        {props.world === "spa" ? <dl className="booking-summary__package">
          {props.offerAudience ? <div><dt>מתאים ל</dt><dd>{props.offerAudience}</dd></div> : null}
          {props.offerDuration ? <div><dt>משך הטיפול</dt><dd>{props.offerDuration}</dd></div> : null}
          {props.offerIncludes?.length ? <div><dt>מה כלול</dt><dd>{props.offerIncludes.join(" · ")}</dd></div> : null}
        </dl> : null}
        <ul><li>אין הזנת כרטיס אשראי</li><li>הבקשה נשמרת בסטטוס ממתין</li><li>אישור סופי מתקבל לאחר בדיקת המקום</li></ul>
      </aside>

      <form ref={formRef} className="booking-form booking-form--steps" onSubmit={submit}>
        <section data-booking-step="1" hidden={step !== 1} aria-labelledby="booking-step-one-title">
          <header><span>שלב 1 מתוך 3</span><h2 id="booking-step-one-title">פרטי השהייה</h2></header>
          {isManage ? <label className="form-wide">מספר הזמנה<input name="bookingReference" required /></label> : <>
            {props.world === "spa" ? <SpaAppointmentPicker initialDate={props.initialFrom} initialGuests={props.initialGuests} offerName={props.offerName} offerDuration={props.offerDuration} onSelectionChange={(selection) => {
              setSpaAppointmentReady(selection.ready);
              setArrival(selection.date);
              setGuests(String(selection.guests));
              setSpaComposition(selection.compositionLabel);
              setSpaTime(selection.time);
            }} /> : <label>תאריך הגעה<input name="date" type="date" value={arrival} onChange={(event) => setArrival(event.target.value)} required /></label>}
            {props.world === "vacation" ? <label>תאריך עזיבה<input name="till" type="date" value={departure} min={arrival || undefined} onChange={(event) => setDeparture(event.target.value)} required /></label> : null}
            {props.world !== "spa" ? <label>שעה מועדפת<input name="time" type="time" /></label> : null}
            {props.world !== "spa" ? <label>כמות אורחים או משתתפים<input name="guests" type="number" min="1" value={guests} onChange={(event) => setGuests(event.target.value)} required /></label> : null}
          </>}
          <div className="booking-form__actions form-wide"><button className="button primary" type="button" onClick={() => nextStep(1)}>המשך לפרטי המזמין</button></div>
          {!isManage && props.world === "spa" && !spaAppointmentReady ? <p className="booking-form__hint form-wide" role="status">בחרו הרכב, תאריך ושעה כדי להמשיך.</p> : null}
        </section>

        <section data-booking-step="2" hidden={step !== 2} aria-labelledby="booking-step-two-title">
          <header><span>שלב 2 מתוך 3</span><h2 id="booking-step-two-title">פרטי המזמין</h2></header>
          <label>שם מלא<input name="name" autoComplete="name" minLength={2} value={name} onChange={(event) => setName(event.target.value)} required /></label>
          <label>טלפון<input name="phone" type="tel" inputMode="tel" autoComplete="tel" minLength={7} value={phone} onChange={(event) => setPhone(event.target.value)} required /></label>
          <label>דואר אלקטרוני<input name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label className="form-wide">{isManage ? "מה תרצו לעדכן?" : "בקשות מיוחדות"}<textarea name="notes" rows={4} maxLength={1500} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
          <label className="form-honey" aria-hidden="true">אתר החברה<input name="company_site" tabIndex={-1} autoComplete="off" /></label>
          <label className="consent legal-consent form-wide"><input name="privacy" type="checkbox" required /><span>קראתי והסכמתי ל<Link href="/legal/terms">תקנון האתר</Link> ול<Link href="/legal/privacy">מדיניות הפרטיות</Link>, ואני מאשר או מאשרת שימוש בפרטים לצורך הטיפול בהזמנה.</span></label>
          <div className="booking-form__actions form-wide"><button className="button secondary" type="button" onClick={() => setStep(1)}>חזרה</button><button className="button primary" type="button" onClick={() => nextStep(2)}>המשך לסיכום</button></div>
        </section>

        <section data-booking-step="3" hidden={step !== 3} aria-labelledby="booking-step-three-title">
          <header><span>שלב 3 מתוך 3</span><h2 id="booking-step-three-title">סיכום ושליחת הבקשה</h2></header>
          <div className="booking-review form-wide"><article><span>מקום וחבילה</span><strong>{props.placeName}</strong><small>{props.offerName}{props.offerDuration ? ` · ${props.offerDuration}` : ""}</small></article><article><span>מועד והרכב</span><strong>{arrival || "לפי הבחירה"}{spaTime ? ` בשעה ${spaTime}` : departure ? ` עד ${departure}` : ""}</strong><small>{props.world === "spa" ? `${guests} משתתפים${spaComposition ? `, ${spaComposition}` : ""}` : `${guests} אורחים או משתתפים`}</small></article><article><span>פרטי המזמין</span><strong>{name}</strong><small>{phone}{email ? ` · ${email}` : ""}</small></article><article><span>מחיר הבקשה</span><strong>{props.price}</strong><small>ללא חיוב וללא אשראי בשלב זה</small></article></div>
          <div className="booking-approval-note form-wide"><strong>מה קורה אחרי השליחה?</strong><p>הבקשה נשמרת ומועברת למקום. לאחר בדיקת הזמינות והמחיר יישלח אישור סופי. עד אז הסטטוס הוא ממתין לאישור.</p></div>
          <div className="booking-form__actions form-wide"><button className="button secondary" type="button" onClick={() => setStep(2)}>עריכת הפרטים</button><button className="button primary" disabled={state === "submitting"} type="submit">{state === "submitting" ? "שולחים..." : isManage ? "שליחת בקשת שינוי" : "שליחת בקשת הזמנה"}</button></div>
          {state === "error" ? <p className="form-error form-wide" role="alert">השליחה לא הושלמה. הפרטים נשארו בטופס ואפשר לנסות שוב.</p> : null}
        </section>
      </form>
    </div>
  </main>;
}
