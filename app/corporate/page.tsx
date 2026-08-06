import type { Metadata } from "next";
import Link from "next/link";
import { LeadIntakeForm } from "../components/lead-intake-form";
import { MasuExperience } from "../components/masu-experience";
import { PageShell } from "../components/page-shell";
import { StructuredData } from "../components/structured-data";
import { breadcrumbSchema } from "../lib/seo";

export const metadata: Metadata = {
  title: "אירועי חברה, רווחה ומתנות לעובדים",
  description: "מרכז אחד למנהלות רווחה, משאבי אנוש, עסקים ומועדוני צרכנות: מקומות, תוכן, ספקים, טיפולים וגיפט קארד.",
  alternates: { canonical: "/corporate/" },
};

const solutions = [
  { number: "01", title: "יום גיבוש שיוצאים ממנו עם אנרגיה", text: "מקום מארח, אוכל, פעילות, הסעה ותוכנית יום אחת מסודרת.", href: "/events" },
  { number: "02", title: "אירוע חברה בלי לרדוף אחרי ספקים", text: "מתחם, תקליטן, בר, צילום, עיצוב ותוכן בתיאום מרוכז.", href: "/providers" },
  { number: "03", title: "רווחה שמגיעה למשרד", text: "עיסויים, טיפולי פנים ועמדות טיפול של מאסו לפי גודל הצוות והמועד.", href: "/discover/place?id=masu-home-wellness" },
  { number: "04", title: "חופשה לצוות או להנהלה", text: "מקומות לינה לקבוצה, חדרים, חללים משותפים ופעילויות בסביבה.", href: "/search" },
  { number: "05", title: "מתנה שנותנת לעובד לבחור", text: "גיפט קארד כללי לכל העולמות המשתתפים באתר, ביחידים או בכמות.", href: "/gift-card" },
  { number: "06", title: "הטבה למועדון צרכנות", text: "עמוד הטבה, מבחר חוויות, קוד קמפיין ודוח בקשות מרוכז.", href: "#corporate-contact" },
];

const packages = [
  { title: "רגע לנשום", label: "רווחה במשרד", includes: ["עמדות עיסוי של מאסו", "תיאום לפי כמות העובדים", "חלונות זמן מסודרים", "אפשרות לפעילות חד פעמית או קבועה"] },
  { title: "יוצאים מהשגרה", label: "יום גיבוש", includes: ["בחירת אזור ומקום", "פעילות או מסלול", "ארוחה או ספק קולינרי", "לוח זמנים מלא"] },
  { title: "מרימים אירוע", label: "אירוע חברה", includes: ["מקום לאירוע", "מוזיקה והגברה", "בר או קייטרינג", "צילום, עיצוב ותוכן"] },
  { title: "הבחירה שלהם", label: "מתנות לעובדים", includes: ["גיפט קארד בסכום לבחירה", "ברכה ארגונית", "חלוקה מרוכזת", "מעקב אחר בקשות ומימושים לאחר החיבור"] },
];

export default function CorporatePage() {
  return <PageShell variant="events">
    <StructuredData data={breadcrumbSchema([{ name: "ראשי", path: "/" }, { name: "חברות ורווחה", path: "/corporate/" }])} />
    <main id="main-content" className="corporate-page">
      <section className="corporate-hero"><div className="shell"><div className="corporate-hero__copy"><span className="eyebrow">למנהלות רווחה, משאבי אנוש ומועדוני צרכנות</span><h1>כל מה שצריך כדי לעשות טוב לאנשים שלכם</h1><p>ממקום לאירוע ועד טיפול שמגיע למשרד. בונים חוויה, מתנה או תוכנית רווחה במסלול אחד ברור.</p><div><a className="button primary" href="#corporate-contact">בונים הצעה</a><Link className="button secondary" href="/gift-card">גיפט קארד לעובדים</Link></div></div><div className="corporate-hero__board"><span>מתחילים בצורך, לא בספק</span><ul><li><b>01</b>כמה אנשים?</li><li><b>02</b>מה רוצים להרגיש?</li><li><b>03</b>איפה ומתי?</li><li><b>04</b>מה התקציב?</li></ul><strong>ומכאן מרכיבים את החוויה</strong></div></div></section>

      <section className="section shell corporate-solutions" aria-labelledby="corporate-solutions-title"><div className="section-head"><div><span className="eyebrow">מתאימים פתרון למטרה</span><h2 id="corporate-solutions-title">רעיונות שאפשר להפוך לתוכנית אמיתית</h2><p>כל מסלול מתחבר למקומות ולשירותים שכבר נמצאים בתוך האתר.</p></div></div><div>{solutions.map((solution) => <Link key={solution.number} href={solution.href}><span>{solution.number}</span><h3>{solution.title}</h3><p>{solution.text}</p><strong>לפתיחת האפשרויות</strong></Link>)}</div></section>

      <section className="section corporate-packages"><div className="shell"><div className="section-head"><div><span className="eyebrow">מתחילים מחבילה, מתאימים עד שזה מדויק</span><h2>ארבעה מסלולים שקל להציג ולאשר</h2><p>אין מחיר מדף שמתחבא מאחורי הבטחה. כל הצעה נבנית לפי כמות, מועד, אזור והיקף השירות.</p></div></div><div className="corporate-packages__grid">{packages.map((pack) => <article key={pack.title}><span>{pack.label}</span><h3>{pack.title}</h3><ul>{pack.includes.map((item) => <li key={item}>{item}</li>)}</ul><a className="button secondary" href="#corporate-contact">התאמת החבילה</a></article>)}</div></div></section>

      <section className="section shell corporate-clubs"><div><span className="eyebrow">מועדוני צרכנות וארגונים</span><h2>מייצרים הטבה שנראית כמו מוצר, לא כמו קופון אבוד</h2><p>עמוד ייעודי, תוכן ברור, קהל מתאים ומסלול בקשה שנשאר בתוך אתר וי.</p></div><div><article><b>עמוד הטבה</b><p>הצעה ממותגת עם תנאים, קהל יעד ותאריכים.</p></article><article><b>מבחר חוויות</b><p>נופש, ספא, אירועים, אטרקציות ושירותים.</p></article><article><b>שיוך מקור</b><p>כל בקשה נשמרת עם מקור הקמפיין והארגון.</p></article><article><b>דוח מרוכז</b><p>לאחר חיבור המערכת ניתן יהיה למדוד בקשות, רכישות ומימושים.</p></article></div></section>

      <div className="section shell"><MasuExperience context="corporate" /></div>

      <section className="section corporate-gifts"><div className="shell"><div><span className="eyebrow">כשלא רוצים לבחור בשבילם</span><h2>גיפט קארד שמכבד את הטעם של כל עובד</h2><p>הארגון בוחר סכום וכמות. העובדים בוחרים את החוויה שמתאימה להם מתוך העולמות המשתתפים באתר.</p></div><Link className="button light" href="/gift-card">למרכז הגיפט קארד</Link></div></section>

      <section className="section shell corporate-process"><div className="section-head"><div><span className="eyebrow">איך זה עובד</span><h2>בקשה אחת, תמונה מלאה</h2></div></div><ol><li><span>1</span><div><h3>מספרים מה צריך</h3><p>כמות משתתפים, מועד, אזור, תקציב והמטרה של האירוע או ההטבה.</p></div></li><li><span>2</span><div><h3>בונים שילוב</h3><p>מחברים מקום, ספקים, אוכל, רווחה ומתנה לפי הצורך.</p></div></li><li><span>3</span><div><h3>מקבלים הצעה מסודרת</h3><p>אפשרויות, מה כלול, תנאים ושלבי ביצוע במקום אחד.</p></div></li><li><span>4</span><div><h3>מאשרים ומתקדמים</h3><p>לאחר חיבור מערכות התשלום והזמינות, האישור יתבצע ישירות באתר.</p></div></li></ol></section>

      <section className="section section-tint" id="corporate-contact"><div className="shell corporate-contact"><div><span className="eyebrow">בואו נבנה משהו שאנשים ידברו עליו</span><h2>ספרו לנו מה אתם מתכננים</h2><p>אפשר להגיע גם עם רעיון חלקי. נחזור עם כיוון שמתאים לכמות, למועד ולתקציב.</p><div className="corporate-contact__facts"><span>אירוע חברה</span><span>יום גיבוש</span><span>רווחה במשרד</span><span>מתנות לעובדים</span><span>מועדון צרכנות</span></div></div><LeadIntakeForm purpose="contact" /></div></section>
    </main>
  </PageShell>;
}
