"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageShell } from "../components/page-shell";
import { magazineArticles, magazineCategories } from "../data/magazine-data";
import { HeartIcon, SearchIcon } from "../site-header";

const quizOptions = [
  { label: "שקט וזמן זוגי", slug: "couples-reset", note: "חופשה זוגית בקצב אחר" },
  { label: "זמן איכות עם הילדים", slug: "calm-family-vacation", note: "חופשה משפחתית בלי מרוץ" },
  { label: "לחגוג עם כולם", slug: "private-event-checklist", note: "מארגנים אירוע בלי הפתעות" },
  { label: "לצאת ולגלות", slug: "build-a-day-around-your-stay", note: "בונים יום טיול חכם" },
];

export default function GuidesPage() {
  const [category, setCategory] = useState("הכל");
  const [query, setQuery] = useState("");
  const [saved, setSaved] = useState<string[]>([]);
  const [quizResult, setQuizResult] = useState<(typeof quizOptions)[number] | null>(null);
  const featured = magazineArticles[0];

  useEffect(() => {
    const timer = window.setTimeout(() => setSaved(JSON.parse(localStorage.getItem("vii-magazine-saved") || "[]")), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return magazineArticles.filter((article) => {
      const inCategory = category === "הכל" || article.category === category;
      const inSearch = !normalized || `${article.title} ${article.excerpt} ${article.tags.join(" ")}`.toLowerCase().includes(normalized);
      return inCategory && inSearch;
    });
  }, [category, query]);

  function toggleSaved(slug: string) {
    const next = saved.includes(slug) ? saved.filter((item) => item !== slug) : [...saved, slug];
    setSaved(next);
    localStorage.setItem("vii-magazine-saved", JSON.stringify(next));
  }

  return <PageShell>
    <main id="main-content" className="magazine-page">
      <section className="magazine-masthead">
        <div className="shell magazine-masthead__bar"><span>מגזין וי</span><p>רעיונות טובים לחופשה שמתחילה עוד לפני שיוצאים</p><strong>{magazineArticles.length} כתבות לקריאה</strong></div>
        <div className="shell magazine-feature">
          <div className="magazine-feature__copy">
            <span className="eyebrow">בחירת המערכת</span>
            <h1>החופשה הטובה מתחילה ברעיון טוב</h1>
            <p>מדריכים שימושיים, מסלולים, אנשים ורגעים שיעזרו לכם לתכנן פחות וליהנות יותר.</p>
            <Link className="button primary" href={`/guides/${featured.slug}`}>לכתבה הראשית</Link>
          </div>
          <Link className="magazine-feature__story" href={`/guides/${featured.slug}`}>
            <img src={featured.image} alt={featured.imageAlt} />
            <span>{featured.category}</span>
            <div><small>{featured.readTime} דקות קריאה</small><h2>{featured.title}</h2><p>{featured.excerpt}</p></div>
          </Link>
        </div>
      </section>

      <section className="shell magazine-discovery" aria-label="חיפוש וסינון כתבות">
        <div className="magazine-search"><SearchIcon /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="חיפוש במגזין" aria-label="חיפוש במגזין" /><span>{filtered.length} תוצאות</span></div>
        <div className="magazine-categories" role="group" aria-label="קטגוריות">{magazineCategories.map((item) => <button key={item} type="button" className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}</div>
      </section>

      <section className="section shell magazine-feed">
        <div className="section-head"><div><span className="eyebrow">חדש במגזין</span><h2>{category === "הכל" ? "קוראים, שומרים ויוצאים לדרך" : category}</h2></div>{saved.length > 0 && <span className="magazine-saved-count"><HeartIcon filled />{saved.length} כתבות שמורות</span>}</div>
        {filtered.length ? <div className="magazine-grid">{filtered.map((article, index) => <article key={article.slug} className={index === 0 && category === "הכל" && !query ? "magazine-card magazine-card--wide" : "magazine-card"}>
          <Link className="magazine-card__image" href={`/guides/${article.slug}`}><img src={article.image} alt={article.imageAlt} /><span>{article.category}</span></Link>
          <div className="magazine-card__body"><div className="magazine-card__meta"><span>{article.dateLabel}</span><span>{article.readTime} דקות קריאה</span></div><h3><Link href={`/guides/${article.slug}`}>{article.title}</Link></h3><p>{article.excerpt}</p><div className="magazine-card__footer"><Link href={`/guides/${article.slug}`}>לקריאת הכתבה</Link><button type="button" aria-label={saved.includes(article.slug) ? `הסרת ${article.title} מהשמורים` : `שמירת ${article.title}`} aria-pressed={saved.includes(article.slug)} onClick={() => toggleSaved(article.slug)}><HeartIcon filled={saved.includes(article.slug)} /></button></div></div>
        </article>)}</div> : <div className="magazine-empty"><b>לא מצאנו כתבה מתאימה</b><p>נסו מילה אחרת או עברו לקטגוריה אחרת.</p><button className="button subtle" type="button" onClick={() => { setQuery(""); setCategory("הכל"); }}>איפוס החיפוש</button></div>}
      </section>

      <section className="magazine-quiz-section">
        <div className="shell magazine-quiz">
          <div><span className="eyebrow">מוצאים את הכתבה שלכם</span><h2>מה בא לכם מהחופשה הבאה?</h2><p>בחרו תחושה וניקח אתכם למדריך שמתאים להתחלה.</p></div>
          <div className="magazine-quiz__options">{quizOptions.map((option) => <button type="button" key={option.slug} className={quizResult?.slug === option.slug ? "active" : ""} onClick={() => setQuizResult(option)}><strong>{option.label}</strong><span>{option.note}</span></button>)}</div>
          {quizResult && <div className="magazine-quiz__result" role="status"><span>מצאנו לכם התחלה טובה</span><strong>{magazineArticles.find((article) => article.slug === quizResult.slug)?.title}</strong><Link className="button primary" href={`/guides/${quizResult.slug}`}>קחו אותי לכתבה</Link></div>}
        </div>
      </section>

      <section className="section shell magazine-manifesto"><span>01</span><div><h2>לא עוד רשימות גנריות</h2><p>כל כתבה בנויה כדי לעזור לקבל החלטה, לשאול את השאלות הנכונות ולצאת עם תוכנית פשוטה שאפשר באמת לבצע.</p></div><span>02</span><div><h2>רעיונות שמתחברים למקום</h2><p>המגזין מחבר בין נופש, אירועים, ספא, ספקים ומה שעושים בסביבה, כדי שהחופשה לא תיעצר בעמוד ההזמנה.</p></div></section>
    </main>
  </PageShell>;
}
