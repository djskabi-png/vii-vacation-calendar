"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";

const endpoint = "/api/leads/";

const worldOptions = [
  { id: "vacation", label: "נופש ומקומות אירוח", description: "וילות, צימרים, סוויטות ומתחמי נופש" },
  { id: "events", label: "מתחמי אירועים", description: "לופטים, מתחמים וחללים לאירועים" },
  { id: "spa", label: "ספא וטיפולים", description: "בתי ספא, קליניקות וחבילות טיפול" },
  { id: "hourly", label: "חדרים לפי שעה", description: "חדרים וסוויטות לאירוח קצר" },
  { id: "providers", label: "ספקים ונותני שירות", description: "שפים, תקליטנים, עיצוב, צילום והפעלה" },
  { id: "activities", label: "אטרקציות בסביבה", description: "מסעדות, מסלולים, טיולים וחוויות" },
] as const;

type Purpose = "join" | "contact";
type SubmitState = "idle" | "submitting" | "success" | "error";

export function LeadIntakeForm({ purpose, selectedPackage = "", billingCycle = "" }: { purpose: Purpose; selectedPackage?: string; billingCycle?: "monthly" | "annual" | "" }) {
  const isJoin = purpose === "join";
  const [state, setState] = useState<SubmitState>("idle");
  const [reference, setReference] = useState("");
  const [submissionId, setSubmissionId] = useState("");
  const [selectedWorld, setSelectedWorld] = useState(isJoin && selectedPackage ? "providers" : "vacation");
  const worldSelectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (isJoin) return;
    const requestedWorld = new URLSearchParams(window.location.search).get("world");
    if (requestedWorld && worldOptions.some((world) => world.id === requestedWorld) && worldSelectRef.current) worldSelectRef.current.value = requestedWorld;
  }, [isJoin]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "submitting" || state === "success") return;
    setState("submitting");
    const form = event.currentTarget;
    const values = new FormData(form);
    const requestContext = new URLSearchParams(window.location.search);
    const requestedWorld = requestContext.get("world");
    const requestedPlace = requestContext.get("place");
    const effectiveWorld = String(requestedWorld || values.get("world") || "general");
    const packageEligible = effectiveWorld === "providers" || effectiveWorld === "activities";
    const requestedPackage = packageEligible ? selectedPackage || requestContext.get("package") || "" : "";
    const requestedService = requestContext.get("service");
    const requestedIntent = requestContext.get("intent");
    const contextDetails = [
      requestedPlace ? `מקום או ספק מבוקש: ${requestedPlace}` : "",
      requestedPackage ? `חבילת פרסום: ${requestedPackage}` : "",
      billingCycle ? `מחזור חיוב: ${billingCycle === "annual" ? "שנתי" : "חודשי"}` : "",
      requestedService ? `שירות: ${requestedService}` : "",
      requestedIntent === "activity-order" ? "אופן פנייה: הזמנת אטרקציה מתוך אתר VII" : "",
    ].filter(Boolean);
    const contextSuffix = contextDetails.length ? `\n\n${contextDetails.join("\n")}` : "";
    const id = submissionId || crypto.randomUUID();
    if (!submissionId) setSubmissionId(id);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: id,
          purpose,
          world: effectiveWorld,
          name: values.get("name"),
          phone: values.get("phone"),
          email: values.get("email"),
          organization: values.get("organization"),
          location: values.get("location"),
          website: values.get("website"),
          message: `${values.get("message") || ""}${contextSuffix}`,
          package: requestedPackage || undefined,
          billingCycle: billingCycle || undefined,
          honey: values.get("company_site"),
          privacyAccepted: values.get("privacy") === "on",
          sourcePage: window.location.href,
        }),
      });
      const result = (await response.json()) as { success?: boolean; reference?: string };
      if (!response.ok || !result.success) throw new Error("submission failed");
      setReference(result.reference || "");
      setState("success");
    } catch {
      setState("error");
    }
  }

  if (state === "success") {
    return (
      <section className="lead-form-success" role="status" aria-live="polite">
        <span aria-hidden="true">✓</span>
        <h2>{isJoin ? "הקמת העמוד התחילה" : "הפנייה התקבלה"}</h2>
        <p>{isJoin ? "פרטי העסק והמסלול שבחרתם נשמרו. לאחר אימות קצר תקבלו גישה להעלאת התוכן וקישור אישי לתשלום מאובטח." : "הפרטים נשמרו במערכת והצוות יוכל לחזור אליכם לפי פרטי הקשר שמסרתם."}</p>
        {reference ? <strong dir="ltr">{reference}</strong> : null}
        <Link className="button secondary" href="/">חזרה לדף הבית</Link>
      </section>
    );
  }

  return (
    <form className="lead-intake-form" onSubmit={submit}>
      {isJoin ? (
        <fieldset className="lead-world-picker">
          <legend>לאיזה עולם העסק שייך?</legend>
          <p>הבחירה תעזור לנו להעביר את הפנייה לצוות המתאים.</p>
          <div>
            {worldOptions.map((world) => (
              <label key={world.id}>
                <input defaultChecked={world.id === selectedWorld} required type="radio" name="world" value={world.id} onChange={() => setSelectedWorld(world.id)} />
                <span><strong>{world.label}</strong><small>{world.description}</small></span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <label className="form-wide">נושא הפנייה
          <select ref={worldSelectRef} name="world" defaultValue="general">
            <option value="general">שאלה כללית</option>
            <option value="vacation">נופש ומקומות אירוח</option>
            <option value="events">אירועים</option>
            <option value="spa">ספא</option>
            <option value="hourly">חדרים לפי שעה</option>
            <option value="providers">ספקים</option>
            <option value="activities">אטרקציות בסביבה</option>
          </select>
        </label>
      )}

      {isJoin ? <label>שם העסק<input required name="organization" autoComplete="organization" minLength={2} /></label> : null}
      <label>שם מלא<input required name="name" autoComplete="name" minLength={2} /></label>
      <label>טלפון<input required name="phone" type="tel" inputMode="tel" autoComplete="tel" minLength={7} /></label>
      <label>כתובת דוא״ל, לא חובה<input name="email" type="email" autoComplete="email" /></label>
      {isJoin ? <label>יישוב או אזור<input name="location" autoComplete="address-level2" /></label> : null}
      {isJoin ? <label className="form-wide">אתר או עמוד עסקי, לא חובה<input name="website" type="url" inputMode="url" placeholder="https://" /></label> : null}
      <label className="form-wide">{isJoin ? "ספרו לנו בקצרה על העסק" : "איך נוכל לעזור?"}<textarea required name="message" rows={5} minLength={5} maxLength={3000} /></label>
      <label className="form-honey" aria-hidden="true">אתר החברה<input name="company_site" tabIndex={-1} autoComplete="off" /></label>
      <label className="consent form-wide"><input required name="privacy" type="checkbox" /> <span>קראתי את <Link href="/legal/privacy">מדיניות הפרטיות</Link> ואני מאשר או מאשרת שימוש בפרטים לצורך טיפול בפנייה.</span></label>
      {isJoin && selectedPackage && (selectedWorld === "providers" || selectedWorld === "activities") ? <div className="lead-selected-package form-wide"><span>המסלול שנבחר לספקים ולאטרקציות</span><strong>{selectedPackage}</strong></div> : null}
      {isJoin && selectedPackage && selectedWorld !== "providers" && selectedWorld !== "activities" ? <div className="lead-selected-package lead-selected-package--custom form-wide"><span>למסלול הזה נבנה הצעה מותאמת</span><strong>המחיר אינו מחויב בשלב הזה</strong></div> : null}
      <button className="button primary form-wide" type="submit" disabled={state === "submitting"}>{state === "submitting" ? "פותחים את החשבון..." : isJoin && (selectedWorld === "providers" || selectedWorld === "activities") ? "פתיחת חשבון והמשך לאימות" : isJoin ? "שליחת בקשת הצטרפות" : "שליחת הפנייה"}</button>
      {state === "error" ? <p className="form-error form-wide" role="alert">השליחה לא הושלמה. הפרטים נשארו בטופס ואפשר לנסות שוב.</p> : null}
    </form>
  );
}
