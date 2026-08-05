"use client";

import { useMemo, useState } from "react";
import { LeadIntakeForm } from "../components/lead-intake-form";

type BillingCycle = "monthly" | "annual";
type PlanId = "standard" | "premium";

const plans = {
  standard: {
    name: "סטנדרט",
    monthly: 149,
    annual: 1490,
    description: "לעסק שרוצה עמוד מלא, שליטה עצמית ונוכחות קבועה בחיפוש.",
    features: [
      "עמוד עסק מלא עם גלריה, וידאו, חבילות ושאלות נפוצות",
      "כניסה אישית לניהול התוכן והמחירים",
      "יומן דיגיטלי של ביז אונליין וניהול זמינות",
      "הופעה בחיפוש, במפה ובעמוד הקטגוריה",
      "קבלת לידים, שיחות ובקשות מחיר",
      "נתוני צפייה ופניות בסיסיים",
      "כלים לאיסוף חוות דעת מאומתות",
    ],
  },
  premium: {
    name: "פרימיום",
    monthly: 349,
    annual: 3490,
    description: "לעסק שרוצה קדימות, חשיפה רחבה יותר ותוכן שעובד חזק לאורך השנה.",
    features: [
      "כל מה שכלול במסלול סטנדרט",
      "קדימות בתוצאות ובאזורים מומלצים",
      "סימון עסק פרימיום בכרטיס ובעמוד",
      "שילוב בסבבי תוכן של עמודי הסושיאל והקהילות",
      "עד שתי חשיפות תוכן יזומות בכל רבעון, בכפוף להתאמת החומר",
      "כתבת תוכן מערכתית אחת בכל שנת מנוי",
      "נתונים מורחבים ושיחת אופטימיזציה תקופתית",
      "ליווי בהקמת העמוד ובניית החבילות הראשונות",
    ],
  },
} as const;

const launchSteps = [
  ["בוחרים מסלול", "המחיר נשמר יחד עם בקשת ההצטרפות."],
  ["פותחים חשבון", "ממלאים את פרטי העסק ומקבלים גישה להעלאת התוכן."],
  ["מאמתים ומשלמים", "לאחר בדיקה קצרה מתקבל קישור מאובטח לתשלום באשראי."],
  ["עולים לאתר", "העמוד עובר בדיקת איכות ומתפרסם כשהפרטים מלאים ותקינים."],
] as const;

export function PartnerOnboarding() {
  const [billing, setBilling] = useState<BillingCycle>("annual");
  const [selectedPlan, setSelectedPlan] = useState<PlanId>("standard");
  const selected = plans[selectedPlan];
  const selectedPrice = billing === "annual" ? selected.annual : selected.monthly;
  const priceLabel = billing === "annual" ? `${selectedPrice.toLocaleString("he-IL")} ₪ לשנה` : `${selectedPrice} ₪ לחודש`;
  const selectionLabel = useMemo(() => `${selected.name}, ${billing === "annual" ? "תשלום שנתי" : "תשלום חודשי"}`, [billing, selected.name]);

  function choosePlan(plan: PlanId) {
    setSelectedPlan(plan);
    window.setTimeout(() => document.getElementById("join-form")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  return (
    <>
      <section id="join-pricing" className="section section-tint join-pricing" aria-labelledby="join-pricing-title">
        <div className="shell">
          <div className="section-head join-pricing__head">
            <div>
              <span className="eyebrow">מחיר היכרות לספקים ולאטרקציות</span>
              <h2 id="join-pricing-title">בוחרים כמה חשיפה העסק צריך</h2>
              <p>שני המסלולים כוללים עמוד מלא, ניהול עצמי ויומן דיגיטלי. אפשר לשלם חודשי או לחסוך במסלול שנתי.</p>
            </div>
            <div className="billing-toggle" aria-label="תקופת תשלום">
              <button type="button" className={billing === "monthly" ? "active" : ""} aria-pressed={billing === "monthly"} onClick={() => setBilling("monthly")}>חודשי</button>
              <button type="button" className={billing === "annual" ? "active" : ""} aria-pressed={billing === "annual"} onClick={() => setBilling("annual")}>שנתי <span>חודשיים מתנה</span></button>
            </div>
          </div>

          <div className="pricing-grid">
            {(Object.keys(plans) as PlanId[]).map((planId) => {
              const plan = plans[planId];
              const price = billing === "annual" ? plan.annual : plan.monthly;
              const monthlyEquivalent = billing === "annual" ? Math.round(plan.annual / 12) : plan.monthly;
              const selectedCard = selectedPlan === planId;
              return (
                <article key={planId} className={`pricing-card${planId === "premium" ? " pricing-card--premium" : ""}${selectedCard ? " selected" : ""}`}>
                  {planId === "premium" ? <span className="pricing-card__badge">הכי הרבה חשיפה</span> : <span className="pricing-card__badge">מתחילים חכם</span>}
                  <h3>{plan.name}</h3>
                  <p>{plan.description}</p>
                  <div className="pricing-card__price">
                    <strong>{price.toLocaleString("he-IL")} ₪</strong>
                    <span>{billing === "annual" ? "לשנה" : "לחודש"}</span>
                  </div>
                  {billing === "annual" ? <small>שווה ערך לכ־{monthlyEquivalent} ₪ לחודש</small> : <small>חיוב חודשי מתחדש, ללא התחייבות שנתית</small>}
                  <ul>{plan.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
                  <button className={`button ${planId === "premium" ? "primary" : "secondary"}`} type="button" onClick={() => choosePlan(planId)}>{selectedCard ? "המסלול שנבחר" : `בחירת ${plan.name}`}</button>
                </article>
              );
            })}
          </div>

          <p className="pricing-note">המחירים הם מחירי היכרות ואינם כוללים מע״מ. החשיפה בעמודי הסושיאל ובקהילות כפופה להתאמת התוכן, ללוח הפרסום ולכללי הפלטפורמות.</p>
        </div>
      </section>

      <section id="join-form" className="section shell join-onboarding" aria-labelledby="join-form-title">
        <div className="join-onboarding__intro">
          <span className="eyebrow">המסלול שלכם</span>
          <h2 id="join-form-title">פותחים את העסק באתר</h2>
          <div className="selected-plan-summary">
            <span>{selected.name}</span>
            <strong>{priceLabel}</strong>
            <button type="button" onClick={() => document.getElementById("join-pricing")?.scrollIntoView({ behavior: "smooth" })}>שינוי מסלול</button>
          </div>
          <ol className="join-launch-steps">
            {launchSteps.map(([title, description], index) => (
              <li key={title}>
                <b>{index + 1}</b>
                <span><strong>{title}</strong><small>{description}</small></span>
              </li>
            ))}
          </ol>
          <div className="secure-payment-note">
            <strong>תשלום מאובטח בלבד</strong>
            <p>פרטי אשראי אינם נשמרים בטופס הזה. לאחר אימות העסק יישלח קישור אישי לתשלום מאובטח ולהמשך הקמת העמוד.</p>
          </div>
        </div>
        <LeadIntakeForm purpose="join" selectedPackage={selectionLabel} billingCycle={billing} />
      </section>
    </>
  );
}
