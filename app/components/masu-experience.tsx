import Link from "next/link";

/* eslint-disable @next/next/no-img-element */

type MasuContext = "stay" | "event" | "spa" | "hourly" | "corporate" | "gift";

const copy: Record<MasuContext, { eyebrow: string; title: string; description: string; chips: string[] }> = {
  stay: { eyebrow: "הטיפול מגיע עד החופשה", title: "מוסיפים עיסוי או טיפול פנים בלי לצאת מהמקום", description: "מאסו מתאמת מטפל או מטפלת שמגיעים לווילה, לצימר או למלון עם הציוד הנדרש.", chips: ["עיסוי אישי או זוגי", "טיפולי פנים", "ציוד מלא"] },
  event: { eyebrow: "רווחה שמגיעה לאירוע", title: "עמדות עיסוי וטיפולים שמרימים את החוויה", description: "מתאימים מספר מטפלים, ציוד וקצב עבודה לכמות המשתתפים ולאופי האירוע.", chips: ["אירועי חברה", "ימי גיבוש", "כמה מטפלים"] },
  spa: { eyebrow: "עוד דרך לעצור ולנשום", title: "אם לא יוצאים לספא, הספא יכול להגיע אליכם", description: "עיסויים וטיפולי פנים בבית, במלון או במקום הנופש, לפי המועד והאזור.", chips: ["פריסה ארצית", "מטפלים מוסמכים", "בחירת משך"] },
  hourly: { eyebrow: "משלימים את הזמן הפרטי", title: "טיפול שמגיע אליכם בתיאום מראש", description: "אפשר לבדוק התאמה של עיסוי או טיפול פנים למקום ולמשך השהייה שבחרתם.", chips: ["תיאום לפי שעה", "עיסוי", "טיפול פנים"] },
  corporate: { eyebrow: "מאסו לעובדים ולארגונים", title: "רווחה שמגיעה למשרד, ליום הגיבוש או לאירוע", description: "עמדות עיסוי, טיפולים קצרים ותוכניות רווחה חד פעמיות או קבועות לצוותים.", chips: ["משרד", "אירוע חברה", "תוכנית קבועה"] },
  gift: { eyebrow: "מתנה שמגיעה עד הדלת", title: "אפשר להפוך את המתנה גם לטיפול של מאסו", description: "המקבל או המקבלת בוחרים עיסוי או טיפול פנים, מועד ומקום, בכפוף לזמינות.", chips: ["עיסוי עד הבית", "טיפול פנים", "בחירה אישית"] },
};

export function MasuExperience({ context = "stay" }: { context?: MasuContext }) {
  const content = copy[context];
  return <section className={`masu-experience masu-experience--${context}`} aria-labelledby={`masu-title-${context}`}>
    <div className="masu-experience__media">
      <img src="/media/providers/masu/masu-home.jpg" alt="טיפול עיסוי של מאסו בבית הלקוח" />
      <span><img src="/media/providers/masu/masu-logo.png" alt="מאסו" /></span>
    </div>
    <div className="masu-experience__copy">
      <span className="eyebrow">{content.eyebrow}</span>
      <h2 id={`masu-title-${context}`}>{content.title}</h2>
      <p>{content.description}</p>
      <div className="feature-chips">{content.chips.map((chip) => <span key={chip}>{chip}</span>)}</div>
      <div className="masu-experience__actions">
        <Link className="button primary" href="/discover/place/masu-home-wellness">כניסה</Link>
      </div>
    </div>
  </section>;
}
