"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageShell } from "../../components/page-shell";
import { getMagazineArticle, magazineArticles } from "../../data/magazine-data";
import { HeartIcon } from "../../site-header";

export function MagazineArticleView({ initialSlug = magazineArticles[0].slug, readQuery = true }: { initialSlug?: string; readQuery?: boolean }) {
  const [slug, setSlug] = useState(initialSlug);
  const [progress, setProgress] = useState(0);
  const [saved, setSaved] = useState(false);
  const [checked, setChecked] = useState<number[]>([]);
  const [shareStatus, setShareStatus] = useState("");
  const article = getMagazineArticle(slug);
  const related = useMemo(() => magazineArticles.filter((item) => item.slug !== article.slug).sort((a, b) => Number(b.category === article.category) - Number(a.category === article.category)).slice(0, 3), [article]);

  useEffect(() => {
    if (!readQuery) return;
    const timer = window.setTimeout(() => {
      const requested = new URLSearchParams(location.search).get("id");
      setSlug(getMagazineArticle(requested).slug);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [readQuery]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const items = JSON.parse(localStorage.getItem("vii-magazine-saved") || "[]") as string[];
      setSaved(items.includes(article.slug));
      setChecked(JSON.parse(localStorage.getItem(`vii-magazine-checklist-${article.slug}`) || "[]"));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [article.slug]);

  useEffect(() => {
    const update = () => {
      const body = document.querySelector<HTMLElement>(".magazine-article__body");
      if (!body) return;
      const start = body.offsetTop - window.innerHeight * 0.35;
      const distance = Math.max(body.offsetHeight - window.innerHeight * 0.4, 1);
      setProgress(Math.max(0, Math.min(100, ((window.scrollY - start) / distance) * 100)));
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => { window.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, [article.slug]);

  function toggleSaved() {
    const items = JSON.parse(localStorage.getItem("vii-magazine-saved") || "[]") as string[];
    const next = items.includes(article.slug) ? items.filter((item) => item !== article.slug) : [...items, article.slug];
    localStorage.setItem("vii-magazine-saved", JSON.stringify(next));
    setSaved(next.includes(article.slug));
  }

  function toggleChecklist(index: number) {
    const next = checked.includes(index) ? checked.filter((item) => item !== index) : [...checked, index];
    setChecked(next);
    localStorage.setItem(`vii-magazine-checklist-${article.slug}`, JSON.stringify(next));
  }

  async function share() {
    const shareData = { title: article.title, text: article.excerpt, url: location.href };
    if (navigator.share) await navigator.share(shareData);
    else {
      await navigator.clipboard.writeText(location.href);
      setShareStatus("הקישור הועתק");
      window.setTimeout(() => setShareStatus(""), 1800);
    }
  }

  return <PageShell>
    <div className="reading-progress" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>
    <main id="main-content" className="magazine-article">
      <nav className="shell magazine-article__crumbs" aria-label="פירורי לחם"><Link href="/">ראשי</Link><span>/</span><Link href="/guides">מגזין ומדריכים</Link><span>/</span><span aria-current="page">{article.title}</span></nav>
      <header className="shell magazine-article__hero">
        <div className="magazine-article__headline"><span className="eyebrow">{article.category}</span><h1>{article.title}</h1><p>{article.excerpt}</p><div className="magazine-article__meta"><span>מאת מערכת מגזין וי</span><span>{article.dateLabel}</span><span>{article.readTime} דקות קריאה</span></div><div className="magazine-article__actions"><button type="button" aria-pressed={saved} onClick={toggleSaved}><HeartIcon filled={saved} />{saved ? "נשמר לקריאה" : "שמירה לקריאה"}</button><button type="button" onClick={() => void share()}>שיתוף</button>{shareStatus && <span role="status">{shareStatus}</span>}</div></div>
        <figure><img src={article.image} alt={article.imageAlt} /><figcaption>תמונה מעמוד מקום מאומת באתר וי, להמחשת נושא הכתבה.</figcaption></figure>
      </header>

      <div className="shell magazine-article__layout">
        <aside className="article-toc"><span>בכתבה הזאת</span><nav>{article.sections.map((section, index) => <a key={section.id} href={`#${section.id}`}><b>{String(index + 1).padStart(2, "0")}</b>{section.title}</a>)}</nav><div><small>התקדמות בקריאה</small><strong>{Math.round(progress)}%</strong></div></aside>
        <article className="magazine-article__body">
          <p className="article-lead">{article.intro}</p>
          <blockquote><span>השורה התחתונה</span><p>{article.takeaway}</p></blockquote>
          {article.sections.map((section, index) => <section id={section.id} key={section.id}><span className="article-section-number">{String(index + 1).padStart(2, "0")}</span><h2>{section.title}</h2>{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}{section.bullets && <ul>{section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>}{section.tip && <div className="article-tip"><b>טיפ קטן שעושה הבדל</b><p>{section.tip}</p></div>}</section>)}

          <section className="article-checklist" aria-labelledby="checklist-title"><span className="eyebrow">לוקחים את הכתבה איתכם</span><h2 id="checklist-title">רשימת הבדיקה שלי</h2><p>סמנו מה כבר עשיתם. הרשימה נשמרת במכשיר הזה.</p><div>{article.checklist.map((item, index) => <label key={item} className={checked.includes(index) ? "checked" : ""}><input type="checkbox" checked={checked.includes(index)} onChange={() => toggleChecklist(index)} /><span>{item}</span></label>)}</div><footer><span>{checked.length} מתוך {article.checklist.length} הושלמו</span><div><i style={{ width: `${(checked.length / article.checklist.length) * 100}%` }} /></div></footer></section>

          <div className="article-tags">{article.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
          <div className="article-author"><span>וי</span><div><b>מערכת מגזין וי</b><p>כותבים כדי להפוך את הדרך לחופשה לפשוטה, ברורה ומעניינת יותר.</p></div></div>
        </article>
      </div>

      <section className="section magazine-related"><div className="shell"><div className="section-head"><div><span className="eyebrow">ממשיכים לקרוא</span><h2>עוד רעיונות לחופשה הבאה</h2></div><Link href="/guides">לכל הכתבות</Link></div><div className="magazine-related__grid">{related.map((item) => <article key={item.slug}><Link href={`/guides/${item.slug}`}><img src={item.image} alt={item.imageAlt} /><span>{item.category}</span><h3>{item.title}</h3><small>{item.readTime} דקות קריאה</small></Link></article>)}</div></div></section>
    </main>
  </PageShell>;
}

export default function ArticlePage({ initialSlug }: { initialSlug: string }) { return <MagazineArticleView initialSlug={initialSlug} readQuery={false} />; }
