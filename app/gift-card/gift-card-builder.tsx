"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

const amounts = [300, 500, 750, 1000];
const occasions = ["יום הולדת", "תודה", "חתונה", "חג", "מתנה לעובדים", "פשוט לפנק"];

export function GiftCardBuilder() {
  const [amount, setAmount] = useState<number | "custom">(500);
  const [customAmount, setCustomAmount] = useState(600);
  const [occasion, setOccasion] = useState(occasions[0]);
  const [state, setState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [reference, setReference] = useState("");

  const finalAmount = amount === "custom" ? customAmount : amount;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "submitting" || state === "success") return;
    setState("submitting");
    const values = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/leads/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: crypto.randomUUID(),
          purpose: "gift-card",
          world: "all-worlds",
          name: values.get("name"),
          phone: values.get("phone"),
          email: values.get("email"),
          message: `גיפט קארד כללי בסך ${finalAmount} ₪. אירוע: ${occasion}. מקבל או מקבלת: ${values.get("recipient")}. ברכה: ${values.get("message") || "ללא ברכה"}`,
          honey: values.get("company_site"),
          privacyAccepted: values.get("privacy") === "on",
          sourcePage: window.location.href,
        }),
      });
      const result = await response.json() as { success?: boolean; reference?: string };
      if (!response.ok || !result.success) throw new Error("submit failed");
      setReference(result.reference || "");
      setState("success");
    } catch {
      setState("error");
    }
  }

  if (state === "success") return <div className="gift-success" role="status"><span>הגיפט קארד נשמר</span><h2>עכשיו משלימים את התשלום המאובטח</h2><p>הפרטים התקבלו. הצוות יחבר את הבקשה למסלול התשלום וההנפקה של הגיפט קארד.</p>{reference ? <strong dir="ltr">{reference}</strong> : null}<Link className="button primary" href="/">חזרה לדף הבית</Link></div>;

  return <div className="gift-builder">
    <div className="gift-builder__preview" aria-live="polite">
      <div className="gift-card-art"><span>VII GIFT CARD</span><b>{finalAmount.toLocaleString("he-IL")} ₪</b><small>כל החופשה, במתנה אחת</small></div>
      <p>הגיפט קארד מיועד למימוש בחוויות ובעסקים המשתתפים באתר. התנאים והזמינות יוצגו לפני התשלום.</p>
    </div>
    <form onSubmit={submit}>
      <fieldset><legend>בוחרים סכום</legend><div className="gift-choice-row">{amounts.map((value) => <button type="button" key={value} aria-pressed={amount === value} onClick={() => setAmount(value)}>{value} ₪</button>)}<button type="button" aria-pressed={amount === "custom"} onClick={() => setAmount("custom")}>סכום אחר</button></div>{amount === "custom" ? <label>סכום לבחירה<input type="number" min="100" step="50" value={customAmount} onChange={(event) => setCustomAmount(Number(event.target.value))} /></label> : null}</fieldset>
      <fieldset><legend>לאיזו הזדמנות?</legend><div className="gift-choice-row">{occasions.map((value) => <button type="button" key={value} aria-pressed={occasion === value} onClick={() => setOccasion(value)}>{value}</button>)}</div></fieldset>
      <div className="gift-form-grid"><label>השם שלכם<input name="name" required minLength={2} autoComplete="name" /></label><label>טלפון<input name="phone" required minLength={7} type="tel" inputMode="tel" autoComplete="tel" /></label><label>דוא״ל לקבלת הגיפט קארד<input name="email" required type="email" autoComplete="email" /></label><label>שם המקבל או המקבלת<input name="recipient" required minLength={2} /></label><label className="form-wide">ברכה אישית, לא חובה<textarea name="message" rows={3} maxLength={300} /></label></div>
      <label className="form-honey" aria-hidden="true">אתר החברה<input name="company_site" tabIndex={-1} autoComplete="off" /></label>
      <label className="consent"><input name="privacy" type="checkbox" required /><span>קראתי את <Link href="/legal/privacy">מדיניות הפרטיות</Link> ואני מאשר או מאשרת טיפול בפרטים לצורך הרכישה.</span></label>
      <button className="button primary wide" type="submit" disabled={state === "submitting"}>{state === "submitting" ? "שומרים את הפרטים..." : `המשך לרכישת גיפט קארד בסך ${finalAmount.toLocaleString("he-IL")} ₪`}</button>
      {state === "error" ? <p className="form-error" role="alert">הבקשה לא נשמרה. הפרטים נשארו בטופס ואפשר לנסות שוב.</p> : null}
    </form>
  </div>;
}
