"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";

export function GuestReviewStudio({ placeName }: { placeName: string }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [previews, setPreviews] = useState<string[]>([]);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    return () => previews.forEach((url) => URL.revokeObjectURL(url));
  }, [previews]);

  return <section className="guest-gallery" id="guest-photos" aria-labelledby="guest-gallery-title">
    <div className="guest-gallery__intro">
      <span className="eyebrow">התמונות שאחרי החופשה</span>
      <h2 id="guest-gallery-title">גלריית אורחים</h2>
      <p>תמונות אורחים יופיעו כאן רק אחרי הוכחת ביקור ואישור. כרגע עדיין לא פורסמו תמונות אורחים מאומתות למקום הזה.</p>
      <button className="button primary" type="button" onClick={() => { setOpen(true); setFinished(false); }}>הוספת תמונות וחוות דעת</button>
    </div>
    <div className="guest-gallery__empty" aria-label="אין עדיין תמונות אורחים מאומתות"><span>0</span><strong>תמונות אורחים מאומתות</strong><small>כך נשמרת הפרדה ברורה בין תמונות העסק לתוכן של אורחים.</small></div>

    {open ? <div className="review-studio" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
      <form className="review-studio__panel" onSubmit={(event) => { event.preventDefault(); setFinished(true); }}>
        <header><div><span>חוות דעת מאומתת</span><h2>{placeName}</h2></div><button type="button" onClick={() => setOpen(false)}>סגירה</button></header>
        {finished ? <div className="review-studio__success" role="status"><span>✓</span><h3>הטיוטה מוכנה לבדיקה</h3><p>באתר הפעיל היא תועבר למנהל האתר ולמנהל העסק, ורק לאחר אישור תפורסם. בשלב הזה זו המחשת תהליך ואינה נשמרת במערכת.</p><button className="button secondary" type="button" onClick={() => setOpen(false)}>סיום</button></div> : <>
          <section><span className="review-studio__step">1</span><div><h3>איך מוכיחים שביקרנו?</h3><p>מזינים מספר הזמנה או מצרפים אסמכתה. הקובץ משמש לאימות בלבד ולא יוצג באתר.</p><label>מספר הזמנה, אם קיים<input name="booking" inputMode="numeric" /></label><label className="review-upload"><input type="file" accept="image/*,.pdf" /><span>צירוף אסמכתה לביקור</span><small>תמונה או מסמך עד 10 מגה</small></label></div></section>
          <section><span className="review-studio__step">2</span><div><h3>מה הציון שלכם?</h3><div className="rating-picker" role="radiogroup" aria-label="ציון המקום">{[1,2,3,4,5].map((score) => <button key={score} type="button" role="radio" aria-checked={rating === score} onClick={() => setRating(score)}>{score}</button>)}</div><label>מה חשוב שאורחים אחרים ידעו?<textarea required rows={4} minLength={10} /></label></div></section>
          <section><span className="review-studio__step">3</span><div><h3>מוסיפים תמונות מהביקור</h3><p>אפשר לבחור כמה תמונות. לפני הפרסום הן יעברו בדיקה ויהיה אפשר לערוך או להסיר אותן במערכת הניהול.</p><label className="review-upload review-upload--photos"><input type="file" accept="image/*" multiple onChange={(event) => { previews.forEach((url) => URL.revokeObjectURL(url)); setPreviews(Array.from(event.target.files || []).filter((file) => file.type.startsWith("image/")).slice(0, 8).map((file) => URL.createObjectURL(file))); }} /><span>בחירת תמונות</span><small>עד 8 תמונות</small></label>{previews.length ? <div className="review-preview">{previews.map((url, index) => <img key={url} src={url} alt={`תמונה שנבחרה ${index + 1}`} />)}</div> : null}</div></section>
          <label className="review-consent"><input required type="checkbox" />אני מאשר או מאשרת שהתוכן שייך לי ושאפשר להעביר אותו לבדיקה לפני פרסום.</label>
          <button className="button primary wide" type="submit" disabled={!rating}>הכנת חוות הדעת לבדיקה</button>
          <p className="review-studio__notice">זהו מסלול אינטראקטיבי לצוות. שמירת הקבצים, אימות הביקור וניהול האישורים יחוברו למערכת הניהול על ידי צוות הפיתוח.</p>
        </>}
      </form>
    </div> : null}
  </section>;
}
