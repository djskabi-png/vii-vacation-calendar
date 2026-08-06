"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { DemoPaymentFields } from "../components/demo-payment-fields";
import { LeadIntakeForm } from "../components/lead-intake-form";

type BillingCycle = "monthly" | "annual";
type PlanId = "standard" | "premium";
type JoinWorld = "providers" | "vacation" | "events" | "spa" | "hourly" | "activities";

const worlds: Array<{ id: JoinWorld; label: string; description: string }> = [
  { id: "providers", label: "ספקים ונותני שירות", description: "הרשמה מלאה אונליין ובחירת חבילת פרסום" },
  { id: "vacation", label: "נופש ומקומות אירוח", description: "וילות, צימרים, סוויטות ומתחמי נופש" },
  { id: "events", label: "מתחמי אירועים", description: "לופטים, חללים ומקומות לחגיגות" },
  { id: "spa", label: "ספא וטיפולים", description: "בתי ספא, קליניקות וחבילות טיפול" },
  { id: "hourly", label: "חדרים לפי שעה", description: "חדרים וסוויטות לאירוח קצר" },
  { id: "activities", label: "אטרקציות וחוויות", description: "פעילויות, טיולים וחוויות בתשלום" },
];

const plans = {
  standard: {
    name: "סטנדרט",
    monthly: 199,
    annual: 1490,
    description: "לעסק שרוצה עמוד מלא, שליטה עצמית ונוכחות קבועה בחיפוש.",
    features: [
      "עמוד עסק מלא עם גלריה, וידאו, חבילות ושאלות נפוצות",
      "כניסה אישית לניהול התוכן והמחירים",
      "יומן דיגיטלי של ביז אונליין וניהול זמינות",
      "הופעה בחיפוש, במפה ובעמוד הקטגוריה",
      "קבלת לידים, שיחות ובקשות מחיר",
      "נתוני צפייה ופניות בסיסיים",
    ],
  },
  premium: {
    name: "פרימיום",
    monthly: 479,
    annual: 3490,
    description: "לעסק שרוצה קדימות, חשיפה רחבה יותר ותוכן שעובד לאורך השנה.",
    features: [
      "כל מה שכלול במסלול סטנדרט",
      "קדימות בתוצאות ובאזורים מומלצים",
      "סימון עסק פרימיום בכרטיס ובעמוד",
      "שילוב בסבבי תוכן של עמודי הסושיאל והקהילות",
      "עד שתי חשיפות תוכן יזומות בכל רבעון, בכפוף להתאמה",
      "כתבת תוכן מערכתית אחת בכל שנת מנוי",
      "נתונים מורחבים ושיחת אופטימיזציה תקופתית",
    ],
  },
} as const;

const launchSteps = [
  ["בוחרים מסלול", "רואים מראש את מחיר ההתחייבות השנתית ואת המחיר ללא התחייבות."],
  ["פותחים חשבון", "ממלאים את פרטי העסק ומקבלים גישה להעלאת התוכן."],
  ["מאמתים ומשלמים", "לאחר בדיקה קצרה ממשיכים לתשלום ולהשלמת העמוד."],
  ["עולים לאתר", "העמוד עובר בדיקת איכות ומתפרסם כשהפרטים מלאים ותקינים."],
] as const;

export function PartnerOnboarding() {
  const [selectedWorld, setSelectedWorld] = useState<JoinWorld>("providers");
  const [billing, setBilling] = useState<BillingCycle>("annual");
  const [selectedPlan, setSelectedPlan] = useState<PlanId>("standard");
  const [providerStep, setProviderStep] = useState<"details" | "payment" | "success">("details");
  const selected = plans[selectedPlan];
  const selectedPrice = billing === "annual" ? selected.annual : selected.monthly;
  const priceLabel = billing === "annual" ? `${selectedPrice.toLocaleString("he-IL")} ₪ לשנה` : `${selectedPrice} ₪ לחודש`;
  const selectionLabel = useMemo(() => `${selected.name}, ${billing === "annual" ? "התחייבות שנתית" : "חודש בחודשו"}`, [billing, selected.name]);
  const world = worlds.find((item) => item.id === selectedWorld) ?? worlds[0];
  const isProvider = selectedWorld === "providers";

  function chooseWorld(worldId: JoinWorld) {
    setSelectedWorld(worldId);
    window.setTimeout(() => document.getElementById(worldId === "providers" ? "provider-pricing" : "expert-registration")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  function choosePlan(plan: PlanId, cycle: BillingCycle) {
    setSelectedPlan(plan);
    setBilling(cycle);
    setProviderStep("details");
    window.setTimeout(() => document.getElementById("join-form")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  function completeDemoPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProviderStep("success");
  }

  return <>
    <section id="join-pricing" className="section section-tint join-world-pricing" aria-labelledby="join-pricing-title">
      <div className="shell">
        <div className="section-head">
          <div>
            <span className="eyebrow">מחירון ודרך הצטרפות לפי תחום</span>
            <h2 id="join-pricing-title">בוחרים את העולם שמתאים לעסק</h2>
            <p>ספקים יכולים לבחור חבילה ולהתחיל את ההרשמה אונליין. בשאר התחומים נשמור את הפרטים ונעביר אותם לנציג מומחה לבניית שיתוף הפעולה הנכון.</p>
          </div>
        </div>
        <div className="join-world-grid">
          {worlds.map((item) => <button key={item.id} type="button" className={selectedWorld === item.id ? "active" : ""} aria-pressed={selectedWorld === item.id} onClick={() => chooseWorld(item.id)}>
            <strong>{item.label}</strong>
            <small>{item.description}</small>
            <span>{item.id === "providers" ? "מחירים והרשמה אונליין" : "רישום ראשוני לנציג מומחה"}</span>
          </button>)}
        </div>
      </div>
    </section>

    {isProvider ? <section id="provider-pricing" className="section join-pricing" aria-labelledby="provider-pricing-title">
      <div className="shell">
        <div className="section-head join-pricing__head">
          <div>
            <span className="eyebrow">מחיר היכרות לספקים ונותני שירות</span>
            <h2 id="provider-pricing-title">התחייבות שנתית משתלמת משמעותית</h2>
            <p>בכל חבילה רואים את שתי האפשרויות יחד. המחיר השנתי מוצג גם כמחיר חודשי ממוצע, כדי שהחיסכון יהיה ברור.</p>
          </div>
        </div>
        <div className="pricing-grid">
          {(Object.keys(plans) as PlanId[]).map((planId) => {
            const plan = plans[planId];
            const annualMonthly = Math.round(plan.annual / 12);
            const annualSaving = plan.monthly * 12 - plan.annual;
            return <article key={planId} className={`pricing-card${planId === "premium" ? " pricing-card--premium" : ""}${selectedPlan === planId ? " selected" : ""}`}>
              <span className="pricing-card__badge">{planId === "premium" ? "הכי הרבה חשיפה" : "מתחילים חכם"}</span>
              <h3>{plan.name}</h3>
              <p>{plan.description}</p>
              <div className="pricing-choice pricing-choice--recommended">
                <span><b>התחייבות שנתית</b><em>הבחירה המשתלמת</em></span>
                <strong>{annualMonthly} ₪ <small>לחודש</small></strong>
                <p>חיוב שנתי בסך {plan.annual.toLocaleString("he-IL")} ₪</p>
                <mark>חיסכון של {annualSaving.toLocaleString("he-IL")} ₪ בשנה</mark>
                <button type="button" onClick={() => choosePlan(planId, "annual")}>בחירת מסלול שנתי</button>
              </div>
              <div className="pricing-choice">
                <span><b>חודש בחודשו</b><em>ללא התחייבות</em></span>
                <strong>{plan.monthly} ₪ <small>לחודש</small></strong>
                <p>חיוב חודשי מתחדש, ניתן להפסיק לפי תנאי המסלול</p>
                <button type="button" onClick={() => choosePlan(planId, "monthly")}>בחירה ללא התחייבות</button>
              </div>
              <ul>{plan.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
            </article>;
          })}
        </div>
        <p className="pricing-note">המחירים הם מחירי היכרות ואינם כוללים מע״מ. חשיפה בעמודי הסושיאל ובקהילות כפופה להתאמת התוכן, ללוח הפרסום ולכללי הפלטפורמות.</p>
      </div>
    </section> : <section id="expert-registration" className="section shell expert-partnership" aria-labelledby="expert-registration-title">
      <div className="expert-partnership__intro">
        <span className="eyebrow">{world.label}</span>
        <h2 id="expert-registration-title">מתחילים ברישום קצר וממשיכים עם נציג מומחה</h2>
        <p>בפרסום של {world.label} אין חבילת מדף אוטומטית. נבדוק את סוג העסק, אופן ההזמנה, הזמינות והחשיפה המתאימה, ואז נבנה הצעת שיתוף פעולה מסודרת.</p>
        <ul>
          <li>בדיקת התאמה לעולם ולחיפושים הנכונים</li>
          <li>הגדרת עמוד, תוכן, גלריה ואופן הזמנה</li>
          <li>חיבור למומחה שמכיר את התחום</li>
          <li>הצעה מסודרת לפני כל התחייבות</li>
        </ul>
      </div>
      <LeadIntakeForm purpose="join" fixedWorld={selectedWorld} selectedPackage={`שיתוף פעולה מותאם, ${world.label}`} />
    </section>}

    {isProvider ? <section id="join-form" className="section shell join-onboarding" aria-labelledby="join-form-title">
      <div className="join-onboarding__intro">
        <span className="eyebrow">המסלול שלכם</span>
        <h2 id="join-form-title">פותחים את העסק באתר</h2>
        <div className="selected-plan-summary">
          <span>{selected.name}, {billing === "annual" ? "התחייבות שנתית" : "חודש בחודשו"}</span>
          <strong>{priceLabel}</strong>
          <button type="button" onClick={() => document.getElementById("provider-pricing")?.scrollIntoView({ behavior: "smooth" })}>שינוי מסלול</button>
        </div>
        <ol className="join-launch-steps">{launchSteps.map(([title, description], index) => <li key={title} className={providerStep === "payment" && index < 2 || providerStep === "success" ? "complete" : ""}><b>{index + 1}</b><span><strong>{title}</strong><small>{description}</small></span></li>)}</ol>
      </div>
      {providerStep === "details" ? <LeadIntakeForm purpose="join" fixedWorld="providers" selectedPackage={selectionLabel} billingCycle={billing} onSuccess={() => setProviderStep("payment")} /> : providerStep === "payment" ? <form className="supplier-checkout" onSubmit={completeDemoPayment}>
        <span className="eyebrow">שלב התשלום</span>
        <h2>השלמת ההצטרפות אונליין</h2>
        <div className="supplier-checkout__summary"><span>{selectionLabel}</span><strong>{priceLabel}</strong><small>{billing === "annual" ? `כ־${Math.round(selected.annual / 12)} ₪ לחודש בממוצע` : "ללא התחייבות שנתית"}</small></div>
        <DemoPaymentFields amountLabel={priceLabel} />
        <label className="consent legal-consent"><input required name="privacy" type="checkbox" /><span>קראתי והסכמתי ל<Link href="/legal/terms">תקנון האתר</Link> ול<Link href="/legal/privacy">מדיניות הפרטיות</Link>, ואני מאשר או מאשרת את מסלול ההצטרפות שנבחר.</span></label>
        <div className="supplier-checkout__actions"><button className="button secondary" type="button" onClick={() => setProviderStep("details")}>חזרה לפרטי העסק</button><button className="button primary" type="submit">השלמת תשלום ההדגמה</button></div>
      </form> : <section className="supplier-checkout-success" role="status" aria-live="polite">
        <span>ההרשמה הושלמה בהדגמה</span>
        <h2>עמוד הספק מוכן לעבור להקמה</h2>
        <p>המסלול, פרטי העסק ושלב התשלום נשמרו בתהליך ההדגמה. בחיבור הסופי תיפתח מכאן גישה להעלאת תמונות, שירותים, מחירים וזמינות.</p>
        <div><strong>{selectionLabel}</strong><b>{priceLabel}</b></div>
        <Link className="button primary" href="/account">מעבר לחשבון העסק</Link>
      </section>}
    </section> : null}
  </>;
}
