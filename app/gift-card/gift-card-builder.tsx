"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { saveBooking } from "../lib/account";
import { useSiteLanguage } from "../i18n/locale-provider";

const amounts = [300, 500, 750, 1000];
const occasions = ["יום הולדת", "תודה", "חתונה", "חג", "מתנה לעובדים", "פשוט לפנק"];
const designs = [
  { id: "sea", label: "חופש מול הים", note: "כחול וטורקיז" },
  { id: "celebration", label: "רגע של חגיגה", note: "צבעוני ושמח" },
  { id: "calm", label: "זמן לעצמך", note: "נקי ורגוע" },
  { id: "night", label: "ערב יוקרתי", note: "כהה ואלגנטי" },
];

type DeliveryMode = "after-approval" | "scheduled" | "self";

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function GiftDeliveryPicker({ date, time, onDateChange, onTimeChange }: { date: string; time: string; onDateChange: (value: string) => void; onTimeChange: (value: string) => void }) {
  const { language, translate } = useSiteLanguage();
  const locale = { he: "he-IL", en: "en-GB", ru: "ru-RU", fr: "fr-FR" }[language];
  const today = useMemo(() => new Date(), []);
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const monthTitle = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(month);
  const weekdays = useMemo(() => Array.from({ length: 7 }, (_, index) => new Intl.DateTimeFormat(locale, { weekday: "narrow" }).format(new Date(2026, 7, 2 + index))), [locale]);
  const cells = useMemo(() => {
    const values: Array<Date | null> = Array(month.getDay()).fill(null);
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    for (let day = 1; day <= days; day += 1) values.push(new Date(month.getFullYear(), month.getMonth(), day));
    return values;
  }, [month]);
  const minimumMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const times = ["09:00", "12:00", "18:00", "20:00"];

  return <div className="gift-schedule-picker">
    <div className="gift-schedule-picker__calendar">
      <header><button type="button" disabled={month <= minimumMonth} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label={translate("החודש הקודם")}>‹</button><strong>{monthTitle}</strong><button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label={translate("החודש הבא")}>›</button></header>
      <div className="gift-schedule-picker__weekdays" aria-hidden="true">{weekdays.map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div>
      <div className="gift-schedule-picker__days">{cells.map((value, index) => {
        if (!value) return <span key={`blank-${index}`} />;
        const key = dateKey(value);
        const past = value < new Date(today.getFullYear(), today.getMonth(), today.getDate());
        return <button type="button" key={key} disabled={past} aria-pressed={date === key} onClick={() => onDateChange(key)}>{value.getDate()}</button>;
      })}</div>
    </div>
    <div className="gift-schedule-picker__times"><strong>שעה מבוקשת</strong><div>{times.map((value) => <button type="button" key={value} aria-pressed={time === value} onClick={() => onTimeChange(value)}>{value}</button>)}</div></div>
  </div>;
}

type Step = "details" | "payment" | "success";

export function GiftCardBuilder() {
  const [amount, setAmount] = useState<number | "custom">(500);
  const [customAmount, setCustomAmount] = useState(600);
  const [occasion, setOccasion] = useState(occasions[0]);
  const [design, setDesign] = useState(designs[0].id);
  const [step, setStep] = useState<Step>("details");
  const [state, setState] = useState<"idle" | "submitting" | "error">("idle");
  const [reference, setReference] = useState("");
  const [sender, setSender] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [recipient, setRecipient] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [message, setMessage] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("09:00");
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>("after-approval");
  const [detailsError, setDetailsError] = useState("");
  const [activeFormSection, setActiveFormSection] = useState(1);

  const finalAmount = amount === "custom" ? customAmount : amount;
  const selectedDesign = designs.find((item) => item.id === design) || designs[0];

  function continueToPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const invalid = form.querySelector(":invalid") as HTMLInputElement | HTMLTextAreaElement | null;
    if (invalid) {
      const panel = invalid.closest<HTMLElement>("[data-gift-section]");
      setActiveFormSection(Number(panel?.dataset.giftSection || 1));
      requestAnimationFrame(() => invalid.reportValidity());
      return;
    }
    if (deliveryMode !== "self" && !recipientPhone && !recipientEmail) {
      setActiveFormSection(3);
      setDetailsError("כדי למסור את המתנה צריך למלא טלפון או דואר אלקטרוני של המקבל או המקבלת.");
      return;
    }
    if (deliveryMode === "scheduled" && !deliveryDate) {
      setActiveFormSection(4);
      setDetailsError("בחרו תאריך למסירת המתנה.");
      return;
    }
    setDetailsError("");
    setStep("payment");
  }

  async function submitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "submitting") return;
    setState("submitting");
    const values = new FormData(event.currentTarget);
    const id = crypto.randomUUID();
    try {
      const response = await fetch("/api/leads/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: id,
          purpose: "gift-card",
          world: "all-worlds",
          name: sender,
          phone,
          email,
          message: `גיפט קארד כללי בסך ${finalAmount} ₪. עיצוב: ${selectedDesign.label}. אירוע: ${occasion}. מקבל או מקבלת: ${recipient}. אופן מסירה: ${deliveryMode}. משלוח: ${deliveryDate || "לאחר אישור"} ${deliveryTime}. ברכה: ${message || "ללא ברכה"}`,
          honey: values.get("company_site"),
          privacyAccepted: values.get("privacy") === "on",
          sourcePage: window.location.href,
        }),
      });
      const result = await response.json() as { success?: boolean; reference?: string };
      if (!response.ok || !result.success) throw new Error("submit failed");
      const orderReference = result.reference || `GIFT-${id.slice(0, 8).toUpperCase()}`;
      setReference(orderReference);
      saveBooking({ id, reference: orderReference, world: "gift-card", placeName: "גיפט קארד VII", offerName: `${selectedDesign.label}, ${finalAmount} ₪`, date: `${deliveryDate} ${deliveryTime}`, status: "pending", createdAt: new Date().toISOString() });
      setStep("success");
      setState("idle");
    } catch {
      setState("error");
    }
  }

  return <div className="gift-checkout">
    <ol className="gift-checkout__steps" aria-label="שלבי רכישת גיפט קארד">
      <li aria-current={step === "details" ? "step" : undefined} className={step !== "details" ? "complete" : ""}><span>1</span><b>עיצוב ומשלוח</b></li>
      <li aria-current={step === "payment" ? "step" : undefined} className={step === "success" ? "complete" : ""}><span>2</span><b>בדיקה ואישור</b></li>
      <li aria-current={step === "success" ? "step" : undefined}><span>3</span><b>קליטת הבקשה</b></li>
    </ol>

    {step === "success" ? <section className="gift-thank-you" role="status" aria-live="polite">
      <div className="gift-thank-you__intro"><span>תודה, הבקשה נקלטה</span><h2>אנחנו מאמתים את פרטי המתנה</h2><p>לא בוצע חיוב. נציג יאמת את הסכום, מועד השליחה ופרטי המקבל לפני הפקת השובר והמשך לתשלום.</p>{reference ? <strong dir="ltr">{reference}</strong> : null}</div>
      <div className={`gift-voucher gift-voucher--${design}`}><small>VII GIFT CARD</small><h3>{selectedDesign.label}</h3><b>{finalAmount.toLocaleString("he-IL")} ₪</b><p>לכבוד {recipient}</p><span>{message || "שתהיה לך חוויה נפלאה"}</span><footer>תצוגה מקדימה. התוקף ותנאי המימוש יופיעו בשובר הסופי.</footer></div>
      <div className="gift-notification-previews">
        <article><span>הודעת הדואר למקבל או למקבלת</span><h3>{recipient}, מחכה לך מתנה</h3><p>{sender} שלח או שלחה לך גיפט קארד של VII בסך {finalAmount.toLocaleString("he-IL")} ₪. השובר יצורף להודעה ויכלול קישור למימוש.</p><small>{recipientEmail}</small></article>
        <article><span>המסרון למקבל או למקבלת</span><p>{recipient}, קיבלת גיפט קארד של VII מאת {sender}. השובר יישלח בתאריך {deliveryDate} בשעה {deliveryTime}.</p><small>{recipientPhone}</small></article>
        <article><span>אישור הרכישה לקונה</span><h3>ההזמנה נקלטה</h3><p>סיכום הרכישה, מועד השליחה ומספר ההזמנה יישלחו אליך מיד לאחר התשלום.</p><small>{email}</small></article>
      </div>
      <div className="gift-thank-you__actions"><Link className="button primary" href="/account">לצפייה בהזמנות שלי</Link><Link className="button secondary" href="/gift-card">יצירת מתנה נוספת</Link></div>
    </section> : <div className="gift-builder">
      <div className="gift-builder__preview" aria-live="polite">
        <div className="gift-preview-label"><span>התצוגה המקדימה שלכם</span><small>מתעדכנת בזמן אמת</small></div>
        <div className={`gift-card-art gift-card-art--${design}`}>
          <span>VII GIFT CARD</span>
          <div><small>מתנה עבור</small><strong>{recipient || "מישהו או מישהי שאוהבים"}</strong></div>
          <b>{finalAmount.toLocaleString("he-IL")} <i>₪</i></b>
          <p>{message || "שתהיה לך חוויה נפלאה, בדיוק בדרך שלך."}</p>
          <footer><small>מאת {sender || "מישהו שחושב עליך"}</small><em>תצוגה מקדימה</em></footer>
        </div>
        <div className="gift-delivery-preview"><span aria-hidden="true">✉</span><div><b>כך המתנה תגיע</b><p>{deliveryMode === "self" ? "השובר יישלח אליכם כדי שתוכלו למסור אותו בעצמכם." : deliveryMode === "scheduled" ? `לאחר אישור ותשלום, המשלוח יתוזמן ל-${deliveryDate || "תאריך שתבחרו"} בשעה ${deliveryTime}.` : "לאחר אישור ותשלום, השובר המעוצב יוכן למסירה בהקדם."}</p></div></div>
        <p className="gift-builder__truth">זוהי המחשה חיה של העיצוב. לא מתבצע חיוב ולא נשלח שובר לפני אימות הפרטים ואישור התשלום.</p>
      </div>

      {step === "details" ? <form noValidate onSubmit={continueToPayment} className="gift-details-form">
        <section data-gift-section="1" className={`gift-form-panel${activeFormSection === 1 ? " active" : ""}`}>
          <button className="gift-form-section" type="button" onClick={() => setActiveFormSection(1)} aria-expanded={activeFormSection === 1}><span>1</span><div><h3>מה הסכום?</h3><p>{finalAmount.toLocaleString("he-IL")} ₪</p></div><b aria-hidden="true">⌄</b></button>
          <div className="gift-form-panel__body"><fieldset><legend className="sr-only">בוחרים סכום</legend><div className="gift-choice-row gift-amounts">{amounts.map((value) => <button type="button" key={value} aria-pressed={amount === value} onClick={() => setAmount(value)}>{value} ₪</button>)}<button type="button" aria-pressed={amount === "custom"} onClick={() => setAmount("custom")}>סכום אחר</button></div>{amount === "custom" ? <label>סכום לבחירה<input type="number" min="100" step="50" value={customAmount} onChange={(event) => setCustomAmount(Number(event.target.value))} /></label> : null}</fieldset><button className="button secondary wide gift-panel-next" type="button" onClick={() => setActiveFormSection(2)}>המשך לעיצוב</button></div>
        </section>
        <section data-gift-section="2" className={`gift-form-panel${activeFormSection === 2 ? " active" : ""}`}>
          <button className="gift-form-section" type="button" onClick={() => setActiveFormSection(2)} aria-expanded={activeFormSection === 2}><span>2</span><div><h3>איך המתנה תיראה?</h3><p>{selectedDesign.label}</p></div><b aria-hidden="true">⌄</b></button>
          <div className="gift-form-panel__body"><fieldset><legend className="sr-only">בוחרים עיצוב</legend><div className="gift-designs">{designs.map((item) => <button type="button" key={item.id} className={`gift-design gift-design--${item.id}`} aria-pressed={design === item.id} onClick={() => setDesign(item.id)}><span aria-hidden="true" /><b>{item.label}</b><small>{item.note}</small></button>)}</div></fieldset><fieldset><legend>לאיזו הזדמנות?</legend><div className="gift-choice-row">{occasions.map((value) => <button type="button" key={value} aria-pressed={occasion === value} onClick={() => setOccasion(value)}>{value}</button>)}</div></fieldset><button className="button secondary wide gift-panel-next" type="button" onClick={() => setActiveFormSection(3)}>המשך לפרטים</button></div>
        </section>
        <section data-gift-section="3" className={`gift-form-panel${activeFormSection === 3 ? " active" : ""}`}>
          <button className="gift-form-section" type="button" onClick={() => setActiveFormSection(3)} aria-expanded={activeFormSection === 3}><span>3</span><div><h3>למי כותבים?</h3><p>{recipient || "שמות וברכה אישית"}</p></div><b aria-hidden="true">⌄</b></button>
          <div className="gift-form-panel__body"><div className="gift-form-grid">
          <label>השם שלכם<input value={sender} onChange={(event) => setSender(event.target.value)} required minLength={2} autoComplete="name" /></label>
          <label>טלפון שלכם<input value={phone} onChange={(event) => setPhone(event.target.value)} required minLength={7} type="tel" inputMode="tel" autoComplete="tel" /></label>
          <label className="form-wide">דואר אלקטרוני לקבלת אישור<input value={email} onChange={(event) => setEmail(event.target.value)} required type="email" autoComplete="email" /></label>
          <label>שם המקבל או המקבלת<input value={recipient} onChange={(event) => setRecipient(event.target.value)} required minLength={2} /></label>
          <label>טלפון המקבל או המקבלת, לא חובה<input value={recipientPhone} onChange={(event) => setRecipientPhone(event.target.value)} minLength={7} type="tel" inputMode="tel" /></label>
          <label className="form-wide">דואר אלקטרוני של המקבל או המקבלת, לא חובה<input value={recipientEmail} onChange={(event) => setRecipientEmail(event.target.value)} type="email" /></label>
          <label className="form-wide">ברכה אישית, לא חובה<textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={3} maxLength={300} /></label>
          </div>{detailsError ? <p className="form-error" role="alert">{detailsError}</p> : null}<button className="button secondary wide gift-panel-next" type="button" onClick={() => { setDetailsError(""); setActiveFormSection(4); }}>המשך למסירה</button></div>
        </section>
        <section data-gift-section="4" className={`gift-form-panel${activeFormSection === 4 ? " active" : ""}`}>
          <button className="gift-form-section" type="button" onClick={() => setActiveFormSection(4)} aria-expanded={activeFormSection === 4}><span>4</span><div><h3>איך מוסרים?</h3><p>{deliveryMode === "self" ? "שליחה אליי" : deliveryMode === "scheduled" ? "בתאריך שאבחר" : "בהקדם לאחר האישור"}</p></div><b aria-hidden="true">⌄</b></button>
          <div className="gift-form-panel__body"><fieldset><legend className="sr-only">אופן מסירת השובר</legend><div className="gift-delivery-modes"><button type="button" aria-pressed={deliveryMode === "after-approval"} onClick={() => setDeliveryMode("after-approval")}><b>בהקדם לאחר האישור</b><small>מכינים ושולחים לאחר אימות ותשלום</small></button><button type="button" aria-pressed={deliveryMode === "scheduled"} onClick={() => setDeliveryMode("scheduled")}><b>בתאריך שאבחר</b><small>מתאים ליום הולדת או לאירוע</small></button><button type="button" aria-pressed={deliveryMode === "self"} onClick={() => setDeliveryMode("self")}><b>שליחה אליי</b><small>כדי למסור את המתנה בעצמי</small></button></div></fieldset>
          {deliveryMode === "scheduled" ? <GiftDeliveryPicker date={deliveryDate} time={deliveryTime} onDateChange={setDeliveryDate} onTimeChange={setDeliveryTime} /> : null}
          {deliveryMode === "scheduled" ? <input type="hidden" value={deliveryDate} required /> : null}
          {detailsError ? <p className="form-error" role="alert">{detailsError}</p> : null}
          <button className="button primary wide" type="submit">המשך לבדיקה ואישור</button></div>
        </section>
      </form> : <form onSubmit={submitPayment}>
        <div className="gift-payment-summary"><span>המתנה שלכם</span><h3>{selectedDesign.label}</h3><p>לכבוד {recipient}. {deliveryMode === "self" ? "השובר יימסר אליכם." : deliveryMode === "scheduled" ? `המסירה המבוקשת היא בתאריך ${deliveryDate} בשעה ${deliveryTime}.` : "השובר יוכן למסירה לאחר האישור והתשלום."}</p><strong>{finalAmount.toLocaleString("he-IL")} ₪</strong></div>
        <div className="gift-payment-summary"><span>לתשומת לבכם</span><p>הבקשה תישלח לאימות לפני חיוב. לאחר האישור תקבלו קישור מאובטח לתשלום ולהפקת השובר.</p></div>
        <label className="form-honey" aria-hidden="true">אתר החברה<input name="company_site" tabIndex={-1} autoComplete="off" /></label>
        <label className="consent legal-consent"><input name="privacy" type="checkbox" required /><span>קראתי והסכמתי ל<Link href="/legal/terms">תקנון האתר</Link> ול<Link href="/legal/privacy">מדיניות הפרטיות</Link>, ואני מאשר או מאשרת את שליחת בקשת הרכישה.</span></label>
        <div className="gift-payment-actions"><button className="button secondary" type="button" onClick={() => setStep("details")}>חזרה לעריכה</button><button className="button primary" type="submit" disabled={state === "submitting"}>{state === "submitting" ? "שולחים את הבקשה..." : `שליחת בקשה בסך ${finalAmount.toLocaleString("he-IL")} ₪`}</button></div>
        {state === "error" ? <p className="form-error" role="alert">הפעולה לא הושלמה. הפרטים נשמרו במסך ואפשר לנסות שוב.</p> : null}
      </form>}
    </div>}
  </div>;
}
