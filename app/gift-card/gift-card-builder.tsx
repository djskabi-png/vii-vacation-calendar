"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { saveBooking } from "../lib/account";

const amounts = [300, 500, 750, 1000];
const occasions = ["יום הולדת", "תודה", "חתונה", "חג", "מתנה לעובדים", "פשוט לפנק"];
const designs = [
  { id: "sea", label: "חופש מול הים", note: "כחול וטורקיז" },
  { id: "celebration", label: "רגע של חגיגה", note: "צבעוני ושמח" },
  { id: "calm", label: "זמן לעצמך", note: "נקי ורגוע" },
];

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

  const finalAmount = amount === "custom" ? customAmount : amount;
  const selectedDesign = designs.find((item) => item.id === design) || designs[0];

  function continueToPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
          message: `גיפט קארד כללי בסך ${finalAmount} ₪. עיצוב: ${selectedDesign.label}. אירוע: ${occasion}. מקבל או מקבלת: ${recipient}. משלוח: ${deliveryDate} ${deliveryTime}. ברכה: ${message || "ללא ברכה"}`,
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
      <div className={`gift-voucher gift-voucher--${design}`}><small>VII GIFT CARD</small><h3>{selectedDesign.label}</h3><b>{finalAmount.toLocaleString("he-IL")} ₪</b><p>לכבוד {recipient}</p><span>{message || "שתהיה לך חוויה נפלאה"}</span><footer>בתוקף ובכפוף לתקנון המימוש שיופיע בשובר הסופי</footer></div>
      <div className="gift-notification-previews">
        <article><span>הודעת הדואר למקבל או למקבלת</span><h3>{recipient}, מחכה לך מתנה</h3><p>{sender} שלח או שלחה לך גיפט קארד של VII בסך {finalAmount.toLocaleString("he-IL")} ₪. השובר יצורף להודעה ויכלול קישור למימוש.</p><small>{recipientEmail}</small></article>
        <article><span>המסרון למקבל או למקבלת</span><p>{recipient}, קיבלת גיפט קארד של VII מאת {sender}. השובר יישלח בתאריך {deliveryDate} בשעה {deliveryTime}.</p><small>{recipientPhone}</small></article>
        <article><span>אישור הרכישה לקונה</span><h3>ההזמנה נקלטה</h3><p>סיכום הרכישה, מועד השליחה ומספר ההזמנה יישלחו אליך מיד לאחר התשלום.</p><small>{email}</small></article>
      </div>
      <div className="gift-thank-you__actions"><Link className="button primary" href="/account">לצפייה בהזמנות שלי</Link><Link className="button secondary" href="/gift-card">יצירת מתנה נוספת</Link></div>
    </section> : <div className="gift-builder">
      <div className="gift-builder__preview" aria-live="polite">
        <div className={`gift-card-art gift-card-art--${design}`}><span>VII GIFT CARD</span><b>{finalAmount.toLocaleString("he-IL")} ₪</b><strong>{selectedDesign.label}</strong><small>לכבוד {recipient || "מישהו או מישהי שאוהבים"}</small></div>
        <p>השובר יישלח בתאריך ובשעה שתבחרו. הקונה יקבל אישור, ומקבל המתנה יקבל הודעת דואר ומסרון עם השובר וקישור למימוש.</p>
      </div>

      {step === "details" ? <form onSubmit={continueToPayment}>
        <fieldset><legend>בוחרים סכום</legend><div className="gift-choice-row">{amounts.map((value) => <button type="button" key={value} aria-pressed={amount === value} onClick={() => setAmount(value)}>{value} ₪</button>)}<button type="button" aria-pressed={amount === "custom"} onClick={() => setAmount("custom")}>סכום אחר</button></div>{amount === "custom" ? <label>סכום לבחירה<input type="number" min="100" step="50" value={customAmount} onChange={(event) => setCustomAmount(Number(event.target.value))} /></label> : null}</fieldset>
        <fieldset><legend>בוחרים עיצוב</legend><div className="gift-designs">{designs.map((item) => <button type="button" key={item.id} className={`gift-design gift-design--${item.id}`} aria-pressed={design === item.id} onClick={() => setDesign(item.id)}><span aria-hidden="true" /><b>{item.label}</b><small>{item.note}</small></button>)}</div></fieldset>
        <fieldset><legend>לאיזו הזדמנות?</legend><div className="gift-choice-row">{occasions.map((value) => <button type="button" key={value} aria-pressed={occasion === value} onClick={() => setOccasion(value)}>{value}</button>)}</div></fieldset>
        <div className="gift-form-grid">
          <label>השם שלכם<input value={sender} onChange={(event) => setSender(event.target.value)} required minLength={2} autoComplete="name" /></label>
          <label>טלפון שלכם<input value={phone} onChange={(event) => setPhone(event.target.value)} required minLength={7} type="tel" inputMode="tel" autoComplete="tel" /></label>
          <label className="form-wide">דואר אלקטרוני לקבלת אישור<input value={email} onChange={(event) => setEmail(event.target.value)} required type="email" autoComplete="email" /></label>
          <label>שם המקבל או המקבלת<input value={recipient} onChange={(event) => setRecipient(event.target.value)} required minLength={2} /></label>
          <label>טלפון המקבל או המקבלת<input value={recipientPhone} onChange={(event) => setRecipientPhone(event.target.value)} required minLength={7} type="tel" inputMode="tel" /></label>
          <label className="form-wide">דואר אלקטרוני של המקבל או המקבלת<input value={recipientEmail} onChange={(event) => setRecipientEmail(event.target.value)} required type="email" /></label>
          <label>תאריך השליחה<input value={deliveryDate} onChange={(event) => setDeliveryDate(event.target.value)} required type="date" /></label>
          <label>שעת השליחה<input value={deliveryTime} onChange={(event) => setDeliveryTime(event.target.value)} required type="time" /></label>
          <label className="form-wide">ברכה אישית, לא חובה<textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={3} maxLength={300} /></label>
        </div>
        <button className="button primary wide" type="submit">המשך לבדיקה ואישור</button>
      </form> : <form onSubmit={submitPayment}>
        <div className="gift-payment-summary"><span>המתנה שלכם</span><h3>{selectedDesign.label}</h3><p>לכבוד {recipient}, לשליחה בתאריך {deliveryDate} בשעה {deliveryTime}</p><strong>{finalAmount.toLocaleString("he-IL")} ₪</strong></div>
        <div className="gift-payment-summary"><span>לתשומת לבכם</span><p>הבקשה תישלח לאימות לפני חיוב. לאחר האישור תקבלו קישור מאובטח לתשלום ולהפקת השובר.</p></div>
        <label className="form-honey" aria-hidden="true">אתר החברה<input name="company_site" tabIndex={-1} autoComplete="off" /></label>
        <label className="consent legal-consent"><input name="privacy" type="checkbox" required /><span>קראתי והסכמתי ל<Link href="/legal/terms">תקנון האתר</Link> ול<Link href="/legal/privacy">מדיניות הפרטיות</Link>, ואני מאשר או מאשרת את שליחת בקשת הרכישה.</span></label>
        <div className="gift-payment-actions"><button className="button secondary" type="button" onClick={() => setStep("details")}>חזרה לעריכה</button><button className="button primary" type="submit" disabled={state === "submitting"}>{state === "submitting" ? "שולחים את הבקשה..." : `שליחת בקשה בסך ${finalAmount.toLocaleString("he-IL")} ₪`}</button></div>
        {state === "error" ? <p className="form-error" role="alert">הפעולה לא הושלמה. הפרטים נשמרו במסך ואפשר לנסות שוב.</p> : null}
      </form>}
    </div>}
  </div>;
}
