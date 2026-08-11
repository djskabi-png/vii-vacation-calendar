"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { ModernSelect } from "./modern-select";
import { AccountFormPrompt, useAccountAccess } from "./account-access";

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

export function LeadIntakeForm({ purpose, selectedPackage = "", billingCycle = "", fixedWorld = "", onSuccess, submitLabel = "", formVariant = "default" }: { purpose: Purpose; selectedPackage?: string; billingCycle?: "monthly" | "annual" | ""; fixedWorld?: string; onSuccess?: () => void; submitLabel?: string; formVariant?: "default" | "corporate" }) {
  const { account } = useAccountAccess();
  const isJoin = purpose === "join";
  const isAccessibility = purpose === "accessibility";
  const requestedWorld = useSearchParams().get("world");
  const [state, setState] = useState<SubmitState>("idle");
  const [reference, setReference] = useState("");
  const [submissionId, setSubmissionId] = useState("");
  const [selectedWorld, setSelectedWorld] = useState(isJoin && selectedPackage ? "providers" : "vacation");
  const effectiveSelectedWorld = fixedWorld || selectedWorld;
  const [bookingWorld, setBookingWorld] = useState(() => requestedWorld && worldOptions.some((world) => world.id === requestedWorld) ? requestedWorld : "general");

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
    const eventDate = String(values.get("event_date") || "").trim();
    const participants = String(values.get("participants") || "").trim();
    const budget = String(values.get("budget") || "").trim();
    const contextDetails = [
      requestedPlace ? `מקום או ספק מבוקש: ${requestedPlace}` : "",
      requestedPackage ? `חבילת פרסום: ${requestedPackage}` : "",
      billingCycle ? `מחזור חיוב: ${billingCycle === "annual" ? "שנתי" : "חודשי"}` : "",
      requestedService ? `שירות: ${requestedService}` : "",
      requestedIntent === "activity-order" ? "אופן פנייה: הזמנת אטרקציה מתוך אתר VII" : "",
      eventDate ? `מועד משוער: ${eventDate}` : "",
      participants ? `כמות משתתפים: ${participants}` : "",
      budget ? `תקציב משוער: ${budget}` : "",
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
        <h2>{isJoin ? effectiveSelectedWorld === "providers" ? "הקמת עמוד הספק התחילה" : "בקשת שיתוף הפעולה התקבלה" : isAccessibility ? "דיווח הנגישות התקבל" : "בקשת ההזמנה התקבלה"}</h2>
        <p>{isJoin ? effectiveSelectedWorld === "providers" ? "פרטי העסק והמסלול שבחרתם נשמרו. לאחר אימות קצר תקבלו גישה להעלאת התוכן וקישור אישי לתשלום מאובטח." : "הפרטים נשמרו והועברו לנציג מומחה בתחום שבחרתם. הנציג יעבור על העסק ויחזור עם דרך שיתוף הפעולה המתאימה, לפני כל התחייבות." : isAccessibility ? "הדיווח נשמר עם פרטי העמוד והמכשיר שמסרתם כדי שנוכל לבדוק ולטפל בו." : "פרטי ההזמנה נשמרו. הזמינות, המחיר והתנאים יאושרו לפני כל חיוב או התחייבות."}</p>
        {reference ? <strong dir="ltr">{reference}</strong> : null}
        <Link className="button secondary" href="/">חזרה לדף הבית</Link>
      </section>
    );
  }

  return (
    <form className={`lead-intake-form${formVariant === "corporate" ? " lead-intake-form--corporate" : ""}`} onSubmit={submit}>
      {formVariant === "corporate" ? <div className="lead-intake-form__heading form-wide"><span>עוד כמה פרטים ומתחילים</span><h3>למי המומחה חוזר?</h3><p>הפרטים ישמשו להכנת כיוון ראשוני. אין חיוב ואין התחייבות.</p></div> : null}
      {fixedWorld ? <input type="hidden" name="world" value={fixedWorld} /> : isJoin ? (
        <fieldset className="lead-world-picker">
          <legend>לאיזה עולם העסק שייך?</legend>
          <p>הבחירה תעזור לנו להעביר את הפנייה לצוות המתאים.</p>
          <div>
            {worldOptions.map((world) => (
              <label key={world.id}>
                <input defaultChecked={world.id === effectiveSelectedWorld} required type="radio" name="world" value={world.id} onChange={() => setSelectedWorld(world.id)} />
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

      <div className="form-wide"><AccountFormPrompt /></div>
      {isJoin ? <label>שם העסק<input required name="organization" autoComplete="organization" minLength={2} /></label> : null}
      <label>שם מלא<input key={`name-${account?.email || "guest"}`} required name="name" autoComplete="name" minLength={2} defaultValue={account?.name || ""} /></label>
      <label>טלפון לחזרה<input key={`phone-${account?.email || "guest"}`} required name="phone" type="tel" inputMode="tel" autoComplete="tel" minLength={7} defaultValue={account?.phone || ""} /></label>
      <label className={formVariant === "corporate" ? "form-wide" : undefined}>כתובת דוא״ל, לא חובה<input key={`email-${account?.email || "guest"}`} name="email" type="email" autoComplete="email" defaultValue={account?.email || ""} /></label>
      {formVariant === "corporate" ? <>
        <div className="lead-intake-form__divider form-wide"><span>על האירוע</span></div>
        <label>מועד משוער<input name="event_date" placeholder="לדוגמה, סוף ספטמבר" /></label>
        <label>כמות משתתפים<input name="participants" inputMode="numeric" placeholder="לדוגמה, 80 עובדים" /></label>
        <label className="form-wide">תקציב משוער, לא חובה<input name="budget" placeholder="אפשר גם לרשום שעדיין לא נקבע" /></label>
      </> : null}
      {isJoin ? <label>יישוב או אזור<input name="location" autoComplete="address-level2" /></label> : null}
      {isJoin ? <label className="form-wide">אתר או עמוד עסקי, לא חובה<input name="website" type="url" inputMode="url" placeholder="https://" /></label> : null}
      <label className="form-wide">{isJoin ? "ספרו לנו בקצרה על העסק" : isAccessibility ? "תיאור הבעיה, כתובת העמוד, המכשיר והדפדפן" : formVariant === "corporate" ? "מה עוד חשוב שנדע? לא חובה" : "פרטי ההזמנה, תאריך, כמות משתתפים ותקציב"}<textarea required={formVariant !== "corporate"} name="message" rows={formVariant === "corporate" ? 3 : 5} minLength={5} maxLength={3000} placeholder={formVariant === "corporate" ? "רגישויות, מטרת האירוע, אזור מועדף או כל פרט שיעזור לנו לדייק" : undefined} /></label>
      <label className="form-honey" aria-hidden="true">אתר החברה<input name="company_site" tabIndex={-1} autoComplete="off" /></label>
      <label className="consent legal-consent form-wide"><input required name="privacy" type="checkbox" /><span>קראתי והסכמתי ל<Link href="/legal/terms">תקנון האתר</Link> ול<Link href="/legal/privacy">מדיניות הפרטיות</Link>, ואני מאשר או מאשרת שימוש בפרטים לצורך הטיפול בבקשה.</span></label>
      {isJoin && selectedPackage && effectiveSelectedWorld === "providers" ? <div className="lead-selected-package form-wide"><span>המסלול שנבחר לספק</span><strong>{selectedPackage}</strong></div> : null}
      {isJoin && selectedPackage && effectiveSelectedWorld !== "providers" ? <div className="lead-selected-package lead-selected-package--custom form-wide"><span>מסלול שיתוף פעולה מותאם</span><strong>נציג מומחה יחזור לאחר בדיקת הפרטים, ללא חיוב בשלב הזה</strong></div> : null}
      <button className="button primary form-wide" type="submit" disabled={state === "submitting"}>{state === "submitting" ? "שומרים את הפרטים..." : submitLabel || (isJoin && effectiveSelectedWorld === "providers" ? "פתיחת חשבון וקבלת גישה לניהול" : isJoin ? "רישום ראשוני והעברה לנציג מומחה" : isAccessibility ? "שליחת דיווח נגישות" : "המשך להזמנה")}</button>
      {state === "error" ? <div className="form-error form-wide" role="alert"><strong>הפרטים עדיין לא נשמרו</strong><span>לא בוצע חיוב. כל מה שמילאתם נשאר בטופס, ואפשר לנסות שוב בעוד רגע.</span></div> : null}
    </form>
  );
}
