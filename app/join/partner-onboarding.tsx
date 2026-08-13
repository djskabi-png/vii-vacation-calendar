"use client";

import Link from "next/link";
import { Fragment, FormEvent, useMemo, useState } from "react";
import { LeadIntakeForm } from "../components/lead-intake-form";
import { useSiteLanguage, type SiteLanguage } from "../i18n/locale-provider";
import type { JoinWorld } from "./worlds";

type BillingCycle = "monthly" | "annual";
type PlanId = "standard" | "premium";

const worlds: Array<{ id: JoinWorld; label: string; description: string }> = [
  { id: "providers", label: "ספקים ונותני שירות", description: "הרשמה מלאה אונליין ובחירת חבילת פרסום" },
  { id: "vacation", label: "נופש ומקומות אירוח", description: "וילות, צימרים, סוויטות ומתחמי נופש" },
  { id: "events", label: "מתחמי אירועים", description: "לופטים, חללים ומקומות לחגיגות" },
  { id: "spa", label: "ספא וטיפולים", description: "בתי ספא, קליניקות וחבילות טיפול" },
  { id: "hourly", label: "חדרים לפי שעה", description: "חדרים וסוויטות לאירוח קצר" },
  { id: "activities", label: "אטרקציות וחוויות", description: "פעילויות, טיולים וחוויות בתשלום" },
];

const worldContinueCopy: Record<SiteLanguage, { selected: string; provider: string; registration: string }> = {
  he: { selected: "בחרתם", provider: "המשך לבחירת מסלול פרסום", registration: "המשך לרישום והשלמת הפרטים" },
  en: { selected: "Selected", provider: "Continue to advertising plans", registration: "Continue to registration" },
  ru: { selected: "Вы выбрали", provider: "Перейти к рекламным тарифам", registration: "Перейти к регистрации" },
  fr: { selected: "Votre choix", provider: "Continuer vers les formules publicitaires", registration: "Continuer vers l’inscription" },
};

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
  ["מקבלים מערכת ניהול אישית", "נכנסים לאזור העסק ומעלים לבד תמונות, סרטונים, שירותים, חבילות, מחירים ומבצעים."],
  ["מנהלים זמינות והזמנות", "מעדכנים יומן וזמינות, ורואים במקום אחד פניות, הזמנות וחוות דעת."],
  ["מפרסמים וממשיכים לנהל", "אחרי בדיקת איכות העמוד עולה לאתר, וכל שינוי עתידי נשאר בשליטת העסק."],
] as const;

const managementCapabilities = ["עמוד העסק והתוכן", "תמונות, גלריות וסרטונים", "שירותים, חבילות ומחירים", "מבצעים והטבות", "יומן וזמינות", "פניות והזמנות", "חוות דעת", "נתוני צפייה וביצועים"] as const;

export function PartnerOnboarding({ initialWorld = "providers" }: { initialWorld?: JoinWorld }) {
  const { language, translate } = useSiteLanguage();
  const [selectedWorld, setSelectedWorld] = useState<JoinWorld>(initialWorld);
  const [billing, setBilling] = useState<BillingCycle>("annual");
  const [selectedPlan, setSelectedPlan] = useState<PlanId>("standard");
  const [planBilling, setPlanBilling] = useState<Record<PlanId, BillingCycle>>({ standard: "annual", premium: "annual" });
  const [providerStep, setProviderStep] = useState<"details" | "payment" | "success">("details");
  const selected = plans[selectedPlan];
  const selectedPrice = billing === "annual" ? selected.annual : selected.monthly;
  const priceLabel = billing === "annual" ? `${selectedPrice.toLocaleString("he-IL")} ₪ לשנה` : `${selectedPrice} ₪ לחודש`;
  const selectionLabel = useMemo(() => `${selected.name}, ${billing === "annual" ? "התחייבות שנתית" : "חודש בחודשו"}`, [billing, selected.name]);
  const world = worlds.find((item) => item.id === selectedWorld) ?? worlds[0];
  const isProvider = selectedWorld === "providers";
  const continueCopy = worldContinueCopy[language];

  function chooseWorld(worldId: JoinWorld) {
    setSelectedWorld(worldId);
  }

  function continueWithWorld() {
    document.getElementById(isProvider ? "provider-pricing" : "expert-registration")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function choosePlan(plan: PlanId, cycle: BillingCycle) {
    setSelectedPlan(plan);
    setBilling(cycle);
    setProviderStep("details");
    window.setTimeout(() => document.getElementById("join-form")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  function completeRegistration(event: FormEvent<HTMLFormElement>) {
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
          {worlds.map((item) => <Fragment key={item.id}>
            <button type="button" className={selectedWorld === item.id ? "active" : ""} aria-pressed={selectedWorld === item.id} onClick={() => chooseWorld(item.id)}>
              <strong>{item.label}</strong>
              <small>{item.description}</small>
              <span>{item.id === "providers" ? "מחירים והרשמה אונליין" : "רישום ראשוני לנציג מומחה"}</span>
            </button>
            {selectedWorld === item.id ? <div className="join-world-continue" aria-live="polite">
              <span className="join-world-continue__selection">
                <small>{continueCopy.selected}</small>
                <strong>{translate(world.label)}</strong>
              </span>
              <button type="button" className="join-world-continue__button" onClick={continueWithWorld}>
                <span>{isProvider ? continueCopy.provider : continueCopy.registration}</span>
                <b aria-hidden="true">←</b>
              </button>
            </div> : null}
          </Fragment>)}
        </div>
      </div>
    </section>

    {isProvider ? <section id="provider-pricing" className="section join-pricing" aria-labelledby="provider-pricing-title">
      <div className="shell">
        <div className="section-head join-pricing__head">
          <div>
            <span className="eyebrow">מחיר היכרות לספקים ונותני שירות</span>
            <h2 id="provider-pricing-title">התחייבות שנתית משתלמת משמעותית</h2>
            <p>בכל חבילה בוחרים חיוב שנתי או חודשי ורואים מיד את המחיר המתאים. במסלול השנתי המחיר מוצג כממוצע חודשי כדי שהחיסכון יהיה ברור.</p>
          </div>
        </div>
        <div className="pricing-grid">
          {(Object.keys(plans) as PlanId[]).map((planId) => {
            const plan = plans[planId];
            const annualMonthly = Math.round(plan.annual / 12);
            const annualSaving = plan.monthly * 12 - plan.annual;
            const activeBilling = planBilling[planId];
            const isAnnual = activeBilling === "annual";
            const displayedPrice = isAnnual ? annualMonthly : plan.monthly;
            return <article key={planId} className={`pricing-card${planId === "premium" ? " pricing-card--premium" : ""}${selectedPlan === planId ? " selected" : ""}`}>
              <span className="pricing-card__badge">{planId === "premium" ? "הכי הרבה חשיפה" : "מתחילים חכם"}</span>
              <h3>{plan.name}</h3>
              <p>{plan.description}</p>
              <div className="pricing-cycle-toggle" role="group" aria-label={`בחירת אופן חיוב לחבילת ${plan.name}`}>
                <button type="button" className={isAnnual ? "active" : ""} aria-pressed={isAnnual} onClick={() => setPlanBilling((current) => ({ ...current, [planId]: "annual" }))}>
                  <strong>שנתי</strong><small>הכי משתלם</small>
                </button>
                <button type="button" className={!isAnnual ? "active" : ""} aria-pressed={!isAnnual} onClick={() => setPlanBilling((current) => ({ ...current, [planId]: "monthly" }))}>
                  <strong>חודשי</strong><small>ללא התחייבות</small>
                </button>
              </div>
              <div className={`pricing-choice pricing-choice--single${isAnnual ? " pricing-choice--recommended" : ""}`} aria-live="polite">
                <span><b>{isAnnual ? "התחייבות שנתית" : "חודש בחודשו"}</b>{isAnnual ? <em>הבחירה המשתלמת</em> : null}</span>
                <strong>{displayedPrice} ₪ <small>לחודש</small></strong>
                <p>{isAnnual ? `חיוב שנתי בסך ${plan.annual.toLocaleString("he-IL")} ₪` : "חיוב חודשי מתחדש, ניתן להפסיק לפי תנאי המסלול"}</p>
                {isAnnual ? <mark>חיסכון של {annualSaving.toLocaleString("he-IL")} ₪ בשנה</mark> : null}
              </div>
              <button className="button primary pricing-card__select" type="button" onClick={() => choosePlan(planId, activeBilling)}>בחירת חבילת {plan.name}</button>
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
        <span className="eyebrow">העסק שלכם, השליטה שלכם</span>
        <h2 id="join-form-title">מקבלים מערכת ניהול מלאה לעסק</h2>
        <p className="join-onboarding__lead">לא רק עמוד באתר. עם הפעלת החשבון תקבלו כניסה אישית ותנהלו בעצמכם את כל מה שהגולשים רואים ואת כל מה שקורה מאחורי הקלעים.</p>
        <section className="join-management-promise" aria-label="מה אפשר לנהל במערכת העסק">
          <div><strong>אתם מעלים</strong><span>תוכן, תמונות, סרטונים ושירותים</span></div>
          <div><strong>אתם קובעים</strong><span>מחירים, חבילות, מבצעים וזמינות</span></div>
          <div><strong>אתם מנהלים</strong><span>פניות, הזמנות, יומן וחוות דעת</span></div>
          <div><strong>אתם רואים</strong><span>צפיות, ביצועים ופעולות של גולשים</span></div>
        </section>
        <div className="join-management-capabilities" aria-label="יכולות מערכת הניהול">{managementCapabilities.map((capability) => <span key={capability}>{capability}</span>)}</div>
        <div className="selected-plan-summary">
          <span>{selected.name}, {billing === "annual" ? "התחייבות שנתית" : "חודש בחודשו"}</span>
          <strong>{priceLabel}</strong>
          <button type="button" onClick={() => document.getElementById("provider-pricing")?.scrollIntoView({ behavior: "smooth" })}>שינוי מסלול</button>
        </div>
        <ol className="join-launch-steps">{launchSteps.map(([title, description], index) => <li key={title} className={providerStep === "payment" && index < 2 || providerStep === "success" ? "complete" : ""}><b>{index + 1}</b><span><strong>{title}</strong><small>{description}</small></span></li>)}</ol>
      </div>
      {providerStep === "details" ? <LeadIntakeForm purpose="join" fixedWorld="providers" selectedPackage={selectionLabel} billingCycle={billing} onSuccess={() => setProviderStep("payment")} /> : providerStep === "payment" ? <form className="supplier-checkout" onSubmit={completeRegistration}>
        <span className="eyebrow">אישור המסלול</span>
        <h2>מאשרים את בקשת ההצטרפות</h2>
        <div className="supplier-checkout__summary"><span>{selectionLabel}</span><strong>{priceLabel}</strong><small>{billing === "annual" ? `כ־${Math.round(selected.annual / 12)} ₪ לחודש בממוצע` : "ללא התחייבות שנתית"}</small></div>
        <div className="supplier-checkout__summary"><span>השלב הבא</span><p>הבקשה תיבדק לפני פתיחת החשבון ולפני כל חיוב. נציג יחזור אליכם עם אישור המסלול והמשך מאובטח.</p></div>
        <label className="consent legal-consent"><input required name="privacy" type="checkbox" /><span>קראתי והסכמתי ל<Link href="/legal/terms">תקנון האתר</Link> ול<Link href="/legal/privacy">מדיניות הפרטיות</Link>, ואני מאשר או מאשרת את מסלול ההצטרפות שנבחר.</span></label>
        <div className="supplier-checkout__actions"><button className="button secondary" type="button" onClick={() => setProviderStep("details")}>חזרה לפרטי העסק</button><button className="button primary" type="submit">אישור ושליחת הבקשה</button></div>
      </form> : <section className="supplier-checkout-success" role="status" aria-live="polite">
        <span>בקשת ההצטרפות נקלטה</span>
        <h2>העסק מוכן לעבור לאימות ולהקמה</h2>
        <p>המסלול ופרטי העסק נשמרו. לאחר האימות נפתח את מערכת הניהול האישית, ובה תוכלו להעלות תוכן ומדיה, לקבוע שירותים ומחירים, לנהל זמינות ולטפל בפניות ובהזמנות.</p>
        <div><strong>{selectionLabel}</strong><b>{priceLabel}</b></div>
        <Link className="button primary" href="/account">מעבר לחשבון העסק</Link>
      </section>}
    </section> : null}
  </>;
}
