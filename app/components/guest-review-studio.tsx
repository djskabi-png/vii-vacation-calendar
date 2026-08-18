"use client";

/* eslint-disable @next/next/no-img-element */

import { ChangeEvent, FormEvent, KeyboardEvent as ReactKeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import type { LegacyReview } from "../data/legacy-vacation-profiles";
import { useSiteLanguage } from "../i18n/locale-provider";

type ReviewSubject = "place" | "trail";

type PendingReview = {
  id?: string;
  author: string;
  body: string;
  rating: number;
  photoCount?: number;
};

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
  const [pendingReview, setPendingReview] = useState<PendingReview | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const photoInputRef = useRef<HTMLInputElement>(null);
  const resolvedSubjectId = useMemo(() => subjectId || placeName, [placeName, subjectId]);
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

  useEffect(() => {
    let active = true;
    fetch(`/api/reviews?subjectType=${encodeURIComponent(subjectType)}&subjectId=${encodeURIComponent(resolvedSubjectId)}`, { credentials: "same-origin" })
      .then(async (response) => response.ok ? response.json() : null)
      .then((payload) => { if (active && payload?.review) setPendingReview(payload.review); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [resolvedSubjectId, subjectType]);

  function openDialog() {
    setFinished(false);
    setSubmitError("");
    setLocalOpen(true);
  }

  function closeDialog() {
    setLocalOpen(false);
    if (onClose) onClose();
  }

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!rating || submitting) return;
    const form = event.currentTarget;
    setSubmitting(true);
    setSubmitError("");
    const values = new FormData(form);
    values.set("rating", String(rating));
    values.set("subjectId", resolvedSubjectId);
    values.set("subjectType", subjectType);
    values.set("placeName", placeName);
    try {
      const response = await fetch("/api/reviews", { method: "POST", body: values, credentials: "same-origin" });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 401) {
        window.location.href = `/api/auth/google?return_to=${encodeURIComponent(`${window.location.pathname}${window.location.search}#reviews`)}`;
        return;
      }
      if (!response.ok) throw new Error(payload.error || "השליחה לא הושלמה");
      setPendingReview(payload.review);
      setFinished(true);
      form.reset();
      setRating(0);
      previews.forEach((url) => URL.revokeObjectURL(url));
      setPreviews([]);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "השליחה לא הושלמה. אפשר לנסות שוב.");
    } finally {
      setSubmitting(false);
    }
  }

  function selectPhotos(event: ChangeEvent<HTMLInputElement>) {
    previews.forEach((url) => URL.revokeObjectURL(url));
    const files = Array.from(event.target.files || []).filter((file) => file.type.startsWith("image/")).slice(0, 8);
    if (event.target.files && event.target.files.length > 8) setSubmitError("אפשר לצרף עד 8 תמונות");
    else setSubmitError("");
    setPreviews(files.map((file) => URL.createObjectURL(file)));
  }

  const title = isTrail ? "תגובות מטיילים על המסלול" : `חוות דעת על ${placeName}`;
  const buttonLabel = isTrail ? "כתיבת תגובה על המסלול" : "כתיבת חוות דעת";
  const ratingFeedback = rating === 5 ? "מצוין" : rating === 4 ? "טוב מאוד" : rating === 3 ? "טוב" : rating === 2 ? "טעון שיפור" : rating === 1 ? "לא טוב" : "בחרו דירוג";

  function handleRatingKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, score: number) {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const nextScore = event.key === "ArrowUp" || event.key === "ArrowRight" ? Math.min(5, score + 1) : Math.max(1, score - 1);
    setRating(nextScore);
    document.querySelector<HTMLButtonElement>(`.rating-picker button[data-score="${nextScore}"]`)?.focus();
  }

  return <section className="review-experience" id="reviews" aria-labelledby="reviews-title">
    <div className="review-experience__head">
      <div>
        {isTrail ? <span className="eyebrow">מידע מהשטח</span> : null}
        <h2 id="reviews-title">{title}</h2>
        <p>{illustrative ? "חוות הדעת בעמוד זה הן דוגמאות בדיוניות שממחישות את מבנה העמוד בלבד." : "כל תוכן חדש עובר בדיקה לפני שהוא מוצג לציבור."}</p>
      </div>
      <div className="review-experience__actions">
        <button className="button primary" type="button" onClick={openDialog}>{buttonLabel}</button>
        {!isTrail && onOpenGallery ? <button className="button secondary" type="button" onClick={onOpenGallery}>תמונות אורחים</button> : null}
      </div>
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
          <footer>{pendingReview.photoCount ? `${pendingReview.photoCount} תמונות צורפו. ` : ""}התוכן התקבל וממתין לבדיקה. הוא אינו מוצג לגולשים אחרים לפני אישור.</footer>
        </article> : <div className="review-experience__empty">
          <strong>{isTrail ? "היו הראשונים לשתף מידע מהשטח" : "היו הראשונים לכתוב חוות דעת"}</strong>
          <p>{isTrail ? "אפשר לספר על מצב המסלול, דרגת הקושי, עומס, מים ופרטים שיעזרו למטיילים הבאים." : "לאחר בדיקה ואישור, חוות הדעת תופיע כאן עם הציון והשם שבחרתם להציג."}</p>
          <button type="button" onClick={openDialog}>{buttonLabel}</button>
        </div>}
      </div>
    </div>

    {isOpen ? <div className="review-studio" role="dialog" aria-modal="true" aria-label={buttonLabel} onMouseDown={(event) => event.target === event.currentTarget && closeDialog()}>
      <form className="review-studio__panel" onSubmit={submitReview}>
        <header><div><span>{isTrail ? "תגובה שמסייעת למטיילים" : "חוות דעת לאחר ביקור"}</span><h2>{placeName}</h2></div><button type="button" onClick={closeDialog} aria-label="סגירת החלון">סגירה</button></header>
        {finished ? <div className="review-studio__success" role="status"><span>✓</span><h3>התוכן התקבל וממתין לבדיקה</h3><p>חוות הדעת והתמונות נשמרו בהצלחה. רק תוכן שנבדק ואושר יוצג באתר.</p><button className="button secondary" type="button" onClick={closeDialog}>סיום</button></div> : <>
          <section className="review-studio__main"><span className="review-studio__step">1</span><div><h3>{isTrail ? "משתפים מידע מהמסלול" : "משתפים חוויה בקצרה"}</h3><div className="review-studio__identity"><label>השם שיוצג<input name="author" type="text" minLength={2} required /></label><label>{isTrail ? "תאריך הטיול" : "תאריך הביקור"}<input name="visitDate" type="date" max={new Date().toISOString().slice(0, 10)} required /></label></div><div className="review-rating-field"><span className="review-rating-field__label">הדירוג שלכם</span><div className="rating-picker" role="radiogroup" aria-label={isTrail ? "ציון המסלול" : "ציון המקום"}>{[1,2,3,4,5].map((score) => <button key={score} data-score={score} className={score <= rating ? "is-filled" : ""} type="button" role="radio" aria-checked={rating === score} tabIndex={rating === score || (!rating && score === 1) ? 0 : -1} onClick={() => setRating(score)} onKeyDown={(event) => handleRatingKeyDown(event, score)} aria-label={`${score} מתוך 5 כוכבים`}><span aria-hidden="true">★</span></button>)}</div><output className={rating ? "is-selected" : ""} aria-live="polite">{rating ? `${rating} מתוך 5, ${ratingFeedback}` : ratingFeedback}</output></div><label>{isTrail ? "מה חשוב שמטיילים ידעו?" : "מה חשוב שאורחים ידעו?"}<textarea name="review" required rows={4} minLength={20} /></label></div></section>
          <details className="review-studio__optional"><summary>הוספת תמונות או אסמכתה, לא חובה</summary><div>{!isTrail ? <><label>מספר הזמנה, אם קיים<input name="booking" /></label><label className="review-upload"><input name="receipt" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf" /><span>צירוף אסמכתה לביקור</span><small>משמשת לאימות בלבד</small></label></> : null}<label className="review-upload review-upload--photos"><input ref={photoInputRef} name="photos" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple onChange={selectPhotos} /><span>בחירת תמונות</span><small>עד 8 תמונות</small></label>{previews.length ? <div className="review-preview">{previews.map((url, index) => <img key={url} src={url} alt={`תמונה שנבחרה ${index + 1}`} title={`תמונה שנבחרה ${index + 1}`} />)}</div> : null}</div></details>
          <label className="review-consent"><input name="consent" value="yes" required type="checkbox" /><span>אני מאשר או מאשרת שהתוכן שייך לי ושאפשר להעביר אותו לבדיקה לפני פרסום.</span></label>
          {submitError ? <p className="review-studio__error" role="alert">{submitError}</p> : null}
          <button className="button primary wide" type="submit" disabled={!rating || submitting} aria-busy={submitting}>{submitting ? "שולחים ומעלים את התמונות..." : "שליחה לבדיקה"}</button>
          <p className="review-studio__notice">התוכן והקבצים נשמרים באופן מאובטח ומועברים לבדיקה. הם לא יוצגו באתר לפני אישור.</p>
        </>}
      </form>
    </div> : null}
  </section>;
}
