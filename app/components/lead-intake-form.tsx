"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { ModernSelect } from "./modern-select";

const endpoint = "/api/leads/";

const worldOptions = [
  { id: "vacation", label: "נופש ומקומות אירוח", description: "וילות, צימרים, סוויטות ומתחמי נופש" },
  { id: "events", label: "מתחמי אירועים", description: "לופטים, מתחמים וחללים לאירועים" },
  { id: "spa", label: "ספא וטיפולים", description: "בתי ספא, קליניקות וחבילות טיפול" },
  { id: "hourly", label: "חדרים לפי שעה", description: "חדרים וסוויטות לאירוח קצר" },
  { id: "providers", label: "ספקים ונותני שירות", description: "שפים, תקליטנים, עיצוב, צילום והפעלה" },
  { id: "activities", label: "אטרקציות בסביבה", description: "מסעדות, מסלולים, טיולים וחוויות" },
] as const;

type Purpose = "join" | "booking" | "accessibility";
type SubmitState = "idle" | "submitting" | "success" | "error";

export function LeadIntakeForm({ purpose, selectedPackage = "", billingCycle = "", fixedWorld = "", onSuccess, submitLabel = "" }: { purpose: Purpose; selectedPackage?: string; billingCycle?: "monthly" | "annual" | ""; fixedWorld?: string; onSuccess?: () => void; submitLabel?: string }) {
  const isJoin = purpose === "join";
  const isAccessibility = purpose === "accessibility";
  const [state, setState] = useState<SubmitState>("idle");
  const [reference, setReference] = useState("");
  const [submissionId, setSubmissionId] = useState("");
  const [selectedWorld, setSelectedWorld] = useState(fixedWorld || (isJoin && selectedPackage ? "providers" : "vacation"));
  const [bookingWorld, setBookingWorld] = useState("general");

  useEffect(() => {
    if (isJoin) return;
    const requestedWorld = new URLSearchParams(window.location.search).get("world");
    if (requestedWorld && worldOptions.some((world) => world.id === requestedWorld)) setBookingWorld(requestedWorld);
  }, [isJoin]);

  useEffect(() => {
    if (fixedWorld) setSelectedWorld(fixedWorld);
  }, [fixedWorld]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "submitting" || state === "success") return;
    setState("submitting");
    const form = event.currentTarget;
    const values = new FormData(form);
    const requestContext = new URLSearchParams(window.location.search);
    const requestedWorld = requestContext.get("world");
    const requestedPlace = requestContext.get("place");
    const effectiveWorld = String(fixedWorld || requestedWorld || values.get("world") || "general");
    const packageEligible = effectiveWorld === "providers" || effectiveWorld === "corporate";
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
      onSuccess?.();
    } catch {
      setState("error");
    }
  }

  if (state === "success") {
    return (
      <section className="lead-form-success" role="status" aria-live="polite">
        <span aria-hidden="true">✓</span>
        <h2>{isJoin ? selectedWorld === "providers" ? "הקמת עמוד הספק התחילה" : "בקשת שיתוף הפעולה התקבלה" : isAccessibility ? "דיווח הנגישות התקבל" : "בקשת ההזמנה התקבלה"}</h2>
        <p>{isJoin ? selectedWorld === "providers" ? "פרטי העסק והמסלול שבחרתם נשמרו. לאחר אימות קצר תקבלו גישה להעלאת התוכן וקישור אישי לתשלום מאובטח." : "הפרטים נשמרו והועברו לנציג מומחה בתחום שבחרתם. הנציג יעבור על העסק ויחזור עם דרך שיתוף הפעולה המתאימה, לפני כל התחייבות." : isAccessibility ? "הדיווח נשמר עם פרטי העמוד והמכשיר שמסרתם כדי שנוכל לבדוק ולטפל בו." : "פרטי ההזמנה נשמרו. הזמינות, המחיר והתנאים יאושרו לפני כל חיוב או התחייבות."}</p>
        {reference ? <strong dir="ltr">{reference}</strong> : null}
        <Link className="button secondary" href="/">חזרה לדף הבית</Link>
      </section>
    );
  }

  return (
    <form className="lead-intake-form" onSubmit={submit}>
      {fixedWorld ? <input type="hidden" name="world" value={fixedWorld} /> : isJoin ? (
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
      ) : isAccessibility ? (
        <input type="hidden" name="world" value="accessibility" />
      ) : (
        <ModernSelect className="form-wide" label="תחום ההזמנה" name="world" value={bookingWorld} onChange={setBookingWorld} options={[
          { value: "general", label: "אירוע חברה או הזמנה משולבת" },
          { value: "vacation", label: "נופש ומקומות אירוח" },
          { value: "events", label: "אירועים" },
          { value: "spa", label: "ספא" },
          { value: "hourly", label: "חדרים לפי שעה" },
          { value: "providers", label: "ספקים" },
          { value: "activities", label: "אטרקציות בסביבה" },
        ]} />
      )}

      {isJoin ? <label>שם העסק<input required name="organization" autoComplete="organization" minLength={2} /></label> : null}
      <label>שם מלא<input required name="name" autoComplete="name" minLength={2} /></label>
      <label>טלפון לחזרה<input required name="phone" type="tel" inputMode="tel" autoComplete="tel" minLength={7} /></label>
      <label>כתובת דוא״ל, לא חובה<input name="email" type="email" autoComplete="email" /></label>
      {isJoin ? <label>יישוב או אזור<input name="location" autoComplete="address-level2" /></label> : null}
      {isJoin ? <label className="form-wide">אתר או עמוד עסקי, לא חובה<input name="website" type="url" inputMode="url" placeholder="https://" /></label> : null}
      <label className="form-wide">{isJoin ? "ספרו לנו בקצרה על העסק" : isAccessibility ? "תיאור הבעיה, כתובת העמוד, המכשיר והדפדפן" : "פרטי ההזמנה, תאריך, כמות משתתפים ותקציב"}<textarea required name="message" rows={5} minLength={5} maxLength={3000} /></label>
      <label className="form-honey" aria-hidden="true">אתר החברה<input name="company_site" tabIndex={-1} autoComplete="off" /></label>
      <label className="consent legal-consent form-wide"><input required name="privacy" type="checkbox" /><span>קראתי והסכמתי ל<Link href="/legal/terms">תקנון האתר</Link> ול<Link href="/legal/privacy">מדיניות הפרטיות</Link>, ואני מאשר או מאשרת שימוש בפרטים לצורך הטיפול בבקשה.</span></label>
      {isJoin && selectedPackage && selectedWorld === "providers" ? <div className="lead-selected-package form-wide"><span>המסלול שנבחר לספק</span><strong>{selectedPackage}</strong></div> : null}
      {isJoin && selectedPackage && selectedWorld !== "providers" ? <div className="lead-selected-package lead-selected-package--custom form-wide"><span>מסלול שיתוף פעולה מותאם</span><strong>נציג מומחה יחזור לאחר בדיקת הפרטים, ללא חיוב בשלב הזה</strong></div> : null}
      <button className="button primary form-wide" type="submit" disabled={state === "submitting"}>{state === "submitting" ? "שומרים את הפרטים..." : submitLabel || (isJoin && selectedWorld === "providers" ? "פתיחת חשבון והמשך לאימות" : isJoin ? "רישום ראשוני והעברה לנציג מומחה" : isAccessibility ? "שליחת דיווח נגישות" : "המשך להזמנה")}</button>
      {state === "error" ? <p className="form-error form-wide" role="alert">השליחה לא הושלמה. הפרטים נשארו בטופס ואפשר לנסות שוב.</p> : null}
    </form>
  );
}
