import Link from "next/link";

/* eslint-disable @next/next/no-img-element */

const destinations = ["צפון", "כנרת", "גליל מערבי", "מרכז", "ירושלים", "ים המלח", "אילת"];

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <section className="footer-about">
          <img src="https://www.vii.co.il/assets/img/logo_new.png" alt="וי פור ויקיישן" />
          <p>מוצאים מקום שמתאים בדיוק לחופשה שלכם, עם חיפוש ברור, מידע שימושי ותהליך בחירה נוח.</p>
        </section>
        <nav aria-label="יעדים פופולריים"><strong>יעדים פופולריים</strong>{destinations.map((item) => <Link key={item} href={`/search/?location=${encodeURIComponent(item)}`}>נופש ב{item}</Link>)}</nav>
        <nav aria-label="שירותים"><strong>שירותים</strong><Link href="/search/">חיפוש חופשה</Link><Link href="/events/">מקומות לאירועים</Link><Link href="/favorites/">מקומות שאהבתי</Link><Link href="/contact/">יצירת קשר</Link></nav>
        <nav aria-label="מידע משפטי"><strong>מידע</strong><Link href="/guides/">מגזין ומדריכים</Link><Link href="/legal/terms/">תקנון</Link><Link href="/legal/privacy/">מדיניות פרטיות</Link><Link href="/legal/cancellation/">ביטול הזמנה</Link></nav>
      </div>
      <div className="shell footer-bottom"><span>© וי פור ויקיישן</span><span>חופשה טובה מתחילה בבחירה טובה</span></div>
    </footer>
  );
}
