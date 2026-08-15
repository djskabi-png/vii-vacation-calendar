"use client";

/* eslint-disable @next/next/no-img-element */

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { LegacyReview } from "../data/legacy-vacation-profiles";
import { useSiteLanguage } from "../i18n/locale-provider";

type ReviewSubject = "place" | "trail";

type PendingReview = {
  author: string;
  body: string;
  rating: number;
};

function readPendingReview(key: string): PendingReview | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(key);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as PendingReview;
  } catch {
    window.localStorage.removeItem(key);
    return null;
  }
}

export function GuestReviewStudio({
  placeName,
  subjectId,
  subjectType = "place",
  rating: publishedRating,
  reviewCount = 0,
  publishedReviews = [],
  open,
  onClose,
  onOpenGallery,
  illustrative = false,
}: {
  placeName: string;
  subjectId?: string;
  subjectType?: ReviewSubject;
  rating?: number;
  reviewCount?: number;
  publishedReviews?: LegacyReview[];
  open?: boolean;
  onClose?: () => void;
  onOpenGallery?: () => void;
  illustrative?: boolean;
}) {
  const { language } = useSiteLanguage();
  const [localOpen, setLocalOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [previews, setPreviews] = useState<string[]>([]);
  const [finished, setFinished] = useState(false);
  const storageKey = useMemo(() => `vii-pending-review:${subjectType}:${subjectId || placeName}`, [placeName, subjectId, subjectType]);
  const [pendingReview, setPendingReview] = useState<PendingReview | null>(() => readPendingReview(storageKey));
  const isOpen = Boolean(open) || localOpen;
  const isTrail = subjectType === "trail";

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && closeDialog();
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    return () => previews.forEach((url) => URL.revokeObjectURL(url));
  }, [previews]);

  function openDialog() {
    setFinished(false);
    setLocalOpen(true);
  }

  function closeDialog() {
    setLocalOpen(false);
    if (onClose) onClose();
  }

  function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!rating) return;
    const values = new FormData(event.currentTarget);
    const draft = {
      author: String(values.get("author") || "אורח או מטייל"),
      body: String(values.get("review") || ""),
      rating,
    };
    window.localStorage.setItem(storageKey, JSON.stringify(draft));
    setPendingReview(draft);
    setFinished(true);
  }

  const title = isTrail ? "תגובות מטיילים על המסלול" : `חוות דעת על ${placeName}`;
  const buttonLabel = isTrail ? "כתיבת תגובה על המסלול" : "כתיבת חוות דעת";

  return <section className="review-experience" id="reviews" aria-labelledby="reviews-title">
    <div className="review-experience__head">
      <div>
        <span className="eyebrow">{isTrail ? "מידע מהשטח" : "מה מספרים אחרי הביקור"}</span>
        <h2 id="reviews-title">{title}</h2>
        <p>{illustrative ? "חוות הדעת בעמוד זה הן דוגמאות בדיוניות שממחישות את מבנה העמוד בלבד." : "כל תוכן חדש עובר בדיקה לפני שהוא מוצג לציבור."}</p>
      </div>
      <button className="button primary" type="button" onClick={openDialog}>{buttonLabel}</button>
    </div>

    <div className="review-experience__body">
      <aside className="review-experience__score">
        {publishedRating ? <><strong>{publishedRating}</strong><span aria-label={`${publishedRating} מתוך 10`}>★★★★★</span><small>{illustrative ? "ציון וחוות דעת בדיוניים להמחשה" : reviewCount ? `${reviewCount} חוות דעת שפורסמו` : "ציון ממקור המידע של המקום"}</small></> : <><strong>חדש</strong><span>הקול שלכם חשוב</span><small>לא פורסמו עדיין חוות דעת מאושרות בעמוד הזה.</small></>}
      </aside>
      <div className="review-experience__list">
        {publishedReviews.length ? <div className="review-experience__published">
          {publishedReviews.map((review) => <article className="review-card review-card--published" key={`${review.visitedAt}-${review.author.he}`}>
            <header><div><strong>{review.author[language]}</strong><span aria-label={`${review.rating} מתוך 10`}>{review.rating}/10</span></div><time dateTime={review.visitedAt}>{new Intl.DateTimeFormat(language === "he" ? "he-IL" : language === "en" ? "en-GB" : language === "ru" ? "ru-RU" : "fr-FR").format(new Date(`${review.visitedAt}T12:00:00`))}</time></header>
            <p>{review.summary[language]}</p>
            <footer>{illustrative ? (language === "he" ? "חוות דעת בדיונית להמחשת העיצוב, לא חוות דעת של אורח אמיתי" : language === "en" ? "Fictional review for design illustration, not a real guest review" : language === "ru" ? "Вымышленный отзыв для демонстрации дизайна, не отзыв реального гостя" : "Avis fictif pour illustrer le design, pas l’avis d’un véritable client") : (language === "he" ? "תמצית חוות דעת מאומתת מארכיון VII" : language === "en" ? "Summary of a verified review from the VII archive" : language === "ru" ? "Краткое содержание проверенного отзыва из архива VII" : "Résumé d’un avis vérifié provenant des archives VII")}</footer>
          </article>)}
        </div> : pendingReview ? <article className="review-card review-card--pending">
          <header><div><strong>{pendingReview.author}</strong><span>{"★".repeat(pendingReview.rating)}{"☆".repeat(5 - pendingReview.rating)}</span></div><small>ממתינה לאישור</small></header>
          <p>{pendingReview.body}</p>
          <footer>התוכן שמור כרגע בדפדפן זה לצורך בדיקת הפרונט, ואינו מוצג לגולשים אחרים.</footer>
        </article> : <div className="review-experience__empty">
          <strong>{isTrail ? "היו הראשונים לשתף מידע מהשטח" : "היו הראשונים לכתוב חוות דעת"}</strong>
          <p>{isTrail ? "אפשר לספר על מצב המסלול, דרגת הקושי, עומס, מים ופרטים שיעזרו למטיילים הבאים." : "לאחר בדיקה ואישור, חוות הדעת תופיע כאן עם הציון והשם שבחרתם להציג."}</p>
          <button type="button" onClick={openDialog}>{buttonLabel}</button>
        </div>}
      </div>
    </div>

    {!isTrail && onOpenGallery ? <button className="review-experience__gallery-link" type="button" onClick={onOpenGallery}>צפייה בתמונות אורחים מאומתות</button> : null}

    {isOpen ? <div className="review-studio" onMouseDown={(event) => event.target === event.currentTarget && closeDialog()}>
      <form className="review-studio__panel" onSubmit={submitReview}>
        <header><div><span>{isTrail ? "תגובה שמסייעת למטיילים" : "חוות דעת לאחר ביקור"}</span><h2>{placeName}</h2></div><button type="button" onClick={closeDialog} aria-label="סגירת החלון">סגירה</button></header>
        {finished ? <div className="review-studio__success" role="status"><span>✓</span><h3>התוכן מוכן לבדיקה</h3><p>הוא נשמר בדפדפן הזה כדי להמחיש את מצב ההמתנה. בחיבור למערכת הניהול הוא יועבר לבדיקה, ורק לאחר אישור יוצג באתר.</p><button className="button secondary" type="button" onClick={closeDialog}>סיום</button></div> : <>
          <section><span className="review-studio__step">1</span><div><h3>{isTrail ? "מי כותב ומה מצב המסלול?" : "מי ביקר במקום?"}</h3><label>השם שיוצג באתר<input name="author" type="text" minLength={2} required /></label><label>{isTrail ? "מתי טיילתם?" : "מתי ביקרתם?"}<input name="visitDate" type="date" required /></label>{!isTrail ? <><p>אפשר לצרף מספר הזמנה או אסמכתה. הקובץ משמש לאימות בלבד ולא יוצג באתר.</p><label>מספר הזמנה, אם קיים<input name="booking" inputMode="numeric" /></label><label className="review-upload"><input type="file" accept="image/*,.pdf" /><span>צירוף אסמכתה לביקור</span><small>תמונה או מסמך עד 10 מגה</small></label></> : null}</div></section>
          <section><span className="review-studio__step">2</span><div><h3>{isTrail ? "איך היה המסלול?" : "מה הציון שלכם?"}</h3><div className="rating-picker" role="radiogroup" aria-label={isTrail ? "ציון המסלול" : "ציון המקום"}>{[1,2,3,4,5].map((score) => <button key={score} type="button" role="radio" aria-checked={rating === score} onClick={() => setRating(score)} aria-label={`${score} מתוך 5`}>{score}</button>)}</div><label>{isTrail ? "מה חשוב שמטיילים אחרים ידעו?" : "מה חשוב שאורחים אחרים ידעו?"}<textarea name="review" required rows={5} minLength={20} /></label></div></section>
          <section><span className="review-studio__step">3</span><div><h3>{isTrail ? "מוסיפים תמונות מהשטח" : "מוסיפים תמונות מהביקור"}</h3><p>התמונות יופיעו רק לאחר בדיקה ואישור.</p><label className="review-upload review-upload--photos"><input type="file" accept="image/*" multiple onChange={(event) => { previews.forEach((url) => URL.revokeObjectURL(url)); setPreviews(Array.from(event.target.files || []).filter((file) => file.type.startsWith("image/")).slice(0, 8).map((file) => URL.createObjectURL(file))); }} /><span>בחירת תמונות</span><small>עד 8 תמונות</small></label>{previews.length ? <div className="review-preview">{previews.map((url, index) => <img key={url} src={url} alt={`תמונה שנבחרה ${index + 1}`} title={`תמונה שנבחרה ${index + 1}`} />)}</div> : null}</div></section>
          <label className="review-consent"><input required type="checkbox" /><span>אני מאשר או מאשרת שהתוכן שייך לי ושאפשר להעביר אותו לבדיקה לפני פרסום.</span></label>
          <button className="button primary wide" type="submit" disabled={!rating}>שליחה לבדיקה</button>
          <p className="review-studio__notice">בגרסת הפרונט התוכן נשמר בדפדפן לצורך בדיקת החוויה. שמירת קבצים, אימות ואישור לפרסום יחוברו למערכת הניהול לפני העלייה לאוויר.</p>
        </>}
      </form>
    </div> : null}
  </section>;
}
