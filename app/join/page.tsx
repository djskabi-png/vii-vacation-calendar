import { LeadIntakeForm } from "../components/lead-intake-form";
import { PageShell } from "../components/page-shell";

const steps = [
  ["ממלאים פרטים", "בוחרים את עולם התוכן ומספרים לנו בקצרה על העסק."],
  ["הצוות בודק התאמה", "הבקשה מגיעה ישירות למערכת הלידים עם תיוג ברור."],
  ["מתקדמים יחד", "נציג חוזר אליכם ומסביר מה נדרש כדי להציג את העסק."],
];

export default function JoinPage() {
  return (
    <PageShell showWorldSwitcher={false}>
      <main id="main-content">
        <section className="join-hero">
          <div className="shell">
            <span className="eyebrow">מצטרפים לעולמות של VII</span>
            <h1>מביאים את העסק שלכם למקום שבו מתחילות החופשות</h1>
            <p>מקום אירוח, מתחם אירועים, ספא, חדר לפי שעה, ספק או אטרקציה. בוחרים את התחום ומשאירים פרטים.</p>
          </div>
        </section>
        <section className="section shell join-layout">
          <aside className="join-process">
            <span className="eyebrow">תהליך פשוט וברור</span>
            <h2>מה קורה אחרי השליחה?</h2>
            <ol>{steps.map(([title, description], index) => <li key={title}><b>{index + 1}</b><span><strong>{title}</strong><small>{description}</small></span></li>)}</ol>
            <p>השליחה אינה מפרסמת את העסק אוטומטית. הפרסום מתבצע רק לאחר בדיקה ואישור.</p>
          </aside>
          <LeadIntakeForm purpose="join" />
        </section>
      </main>
    </PageShell>
  );
}
