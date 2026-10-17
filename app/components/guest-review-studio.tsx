"use client";
import { publicReviewError } from "../lib/public-review-error";

/* eslint-disable @next/next/no-img-element */

import { ChangeEvent, FormEvent, KeyboardEvent as ReactKeyboardEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import type { LegacyReview } from "../data/legacy-vacation-profiles";
import type { SupplierPlaceDetail } from "../data/supplier-place-detail";
import { useSiteLanguage } from "../i18n/locale-provider";
import { SliderRailControls } from "./slider-rail-controls";

type ReviewSubject = "place" | "trail";

type PendingReview = {
  id?: string;
  author: string;
  body: string;
  rating: number;
  photoCount?: number;
};

const reviewCopy = {
  he: {
    trailTitle: "תגובות מטיילים על המסלול", title: (name: string) => `חוות דעת על ${name}`, trailButton: "כתיבת תגובה", button: "כתיבת חוות דעת", gallery: "תמונות אורחים",
    fieldNote: "מידע מהשטח", moderation: "כל תוכן חדש עובר בדיקה לפני שהוא מוצג לציבור.", illustrative: "חוות הדעת בעמוד זה בדיוניות ומוצגות להמחשת העיצוב בלבד.",
    outOfTen: (value: number) => `${value} מתוך 10`, published: (count: number) => `${count} חוות דעת שפורסמו`, sourceScore: "דירוג המקום", illustrativeScore: "ציון וחוות דעת בדיוניים להמחשה",
    newLabel: "חדש", voice: "הקול שלכם חשוב", noApproved: "עדיין אין חוות דעת מאושרות בעמוד הזה.", noText: "הדירוג פורסם ללא חוות דעת כתובה.", response: "תגובת המקום", archive: "חוות דעת מארכיון VII", original: "הביקורת מוצגת בשפת המקור",
    more: (count: number) => `הצגת ${count} חוות דעת נוספות`, readMore: "הצגת חוות הדעת המלאה", readLess: "צמצום חוות הדעת", pending: "ממתינה לאישור", photosAttached: (count: number) => `${count} תמונות צורפו. `, pendingBody: "התוכן התקבל וממתין לבדיקה. הוא יוצג לציבור רק לאחר אישור.",
    archiveCount: (count: number) => `${count} חוות דעת בארכיון המקום`, archiveUnavailable: "חוות הדעת הכתובות אינן זמינות כרגע.", firstTrail: "היו הראשונים לשתף מידע מהשטח", first: "היו הראשונים לכתוב חוות דעת", firstTrailBody: "ספרו על מצב המסלול, דרגת הקושי, עומס, מים וכל פרט שיעזור למטיילים הבאים.", firstBody: "לאחר בדיקה ואישור, חוות הדעת תופיע כאן עם הציון והשם שבחרתם להציג.",
    dialogTrail: "תגובה שמסייעת למטיילים", dialog: "חוות דעת לאחר ביקור", close: "סגירה", closeLabel: "סגירת החלון", successTitle: "התוכן התקבל וממתין לבדיקה", successBody: "חוות הדעת והתמונות נשמרו. רק תוכן שנבדק ואושר יוצג באתר.", done: "סיום", shortTrail: "משתפים מידע מהמסלול", short: "משתפים חוויה בקצרה", displayName: "השם שיוצג", tripDate: "תאריך הטיול", visitDate: "תאריך הביקור", yourRating: "הדירוג שלכם", trailRating: "ציון המסלול", placeRating: "ציון המקום", stars: (score: number) => `${score} מתוך 5 כוכבים`, outOfFive: (score: number, feedback: string) => `${score} מתוך 5, ${feedback}`, ratingFeedback: ["בחרו דירוג", "לא טוב", "טעון שיפור", "טוב", "טוב מאוד", "מצוין"], trailPrompt: "מה חשוב שמטיילים ידעו?", placePrompt: "מה חשוב שאורחים ידעו?",
    optional: "הוספת תמונות או אסמכתה, לא חובה", booking: "מספר הזמנה, אם קיים", receipt: "צירוף אסמכתה לביקור", verificationOnly: "משמשת לאימות בלבד", choosePhotos: "בחירת תמונות", upToPhotos: "עד 8 תמונות", selectedPhoto: (index: number) => `תמונה שנבחרה ${index}`, consent: "אני מאשר או מאשרת שהתוכן שייך לי ושאפשר להעביר אותו לבדיקה לפני פרסום.", sending: "שולחים ומעלים את התמונות...", submit: "שליחה לבדיקה", privacy: "התוכן והקבצים נשמרים באופן מאובטח ומועברים לבדיקה. המידע אינו מוצג לגולשים אחרים לפני אישור.", genericError: "השליחה לא הושלמה. אפשר לנסות שוב.", photoLimit: "אפשר לצרף עד 8 תמונות",
  },
  en: {
    trailTitle: "Traveller updates about this trail", title: (name: string) => `Reviews of ${name}`, trailButton: "Share a trail update", button: "Write a review", gallery: "Guest photos",
    fieldNote: "First-hand updates", moderation: "Every new review is checked before it is published.", illustrative: "The reviews on this page are fictional and shown only to illustrate the design.",
    outOfTen: (value: number) => `${value} out of 10`, published: (count: number) => `${count} published reviews`, sourceScore: "Property rating", illustrativeScore: "Illustrative rating and reviews",
    newLabel: "New", voice: "Your experience matters", noApproved: "There are no approved reviews on this page yet.", noText: "This rating was published without a written review.", response: "Property response", archive: "Review from the VII archive", original: "Shown in the reviewer’s original language",
    more: (count: number) => `Show ${count} more reviews`, readMore: "Show full review", readLess: "Collapse review", pending: "Awaiting approval", photosAttached: (count: number) => `${count} photos attached. `, pendingBody: "Your review has been received and is being checked. It will only appear publicly after approval.",
    archiveCount: (count: number) => `${count} reviews in the property archive`, archiveUnavailable: "Written reviews are currently unavailable.", firstTrail: "Be the first to share a trail update", first: "Be the first to review this place", firstTrailBody: "Share the trail conditions, difficulty, crowds, water and anything that may help the next hikers.", firstBody: "Once checked and approved, your review will appear here with your chosen name and rating.",
    dialogTrail: "A useful update for other hikers", dialog: "Review after your visit", close: "Close", closeLabel: "Close review form", successTitle: "Received and awaiting review", successBody: "Your review and photos were saved. Only checked and approved content will appear on the site.", done: "Done", shortTrail: "Share a concise trail update", short: "Tell us briefly about your visit", displayName: "Display name", tripDate: "Hike date", visitDate: "Visit date", yourRating: "Your rating", trailRating: "Trail rating", placeRating: "Property rating", stars: (score: number) => `${score} out of 5 stars`, outOfFive: (score: number, feedback: string) => `${score} out of 5, ${feedback}`, ratingFeedback: ["Choose a rating", "Poor", "Needs improvement", "Good", "Very good", "Excellent"], trailPrompt: "What should other hikers know?", placePrompt: "What should future guests know?",
    optional: "Add photos or proof of visit, optional", booking: "Booking number, if available", receipt: "Attach proof of visit", verificationOnly: "Used for verification only", choosePhotos: "Choose photos", upToPhotos: "Up to 8 photos", selectedPhoto: (index: number) => `Selected photo ${index}`, consent: "I confirm that this content is mine and may be checked before publication.", sending: "Sending and uploading photos...", submit: "Send for review", privacy: "Your content and files are stored securely for review. They will not appear on the site before approval.", genericError: "We could not send your review. Please try again.", photoLimit: "You can attach up to 8 photos",
  },
  ru: {
    trailTitle: "Отзывы путешественников о маршруте", title: (name: string) => `Отзывы о ${name}`, trailButton: "Рассказать о маршруте", button: "Оставить отзыв", gallery: "Фото гостей",
    fieldNote: "Информация с маршрута", moderation: "Каждый новый отзыв проверяется перед публикацией.", illustrative: "Отзывы на этой странице вымышлены и приведены только для демонстрации дизайна.",
    outOfTen: (value: number) => `${value} из 10`, published: (count: number) => `Опубликовано отзывов: ${count}`, sourceScore: "Оценка объекта", illustrativeScore: "Демонстрационные оценка и отзывы",
    newLabel: "Новое", voice: "Ваш опыт важен", noApproved: "На этой странице пока нет одобренных отзывов.", noText: "Оценка опубликована без текста отзыва.", response: "Ответ объекта", archive: "Отзыв из архива VII", original: "Отзыв показан на языке автора",
    more: (count: number) => `Показать ещё ${count}`, readMore: "Показать полный отзыв", readLess: "Свернуть отзыв", pending: "Ожидает проверки", photosAttached: (count: number) => `Прикреплено фото: ${count}. `, pendingBody: "Отзыв получен и проходит проверку. Он появится на сайте только после одобрения.",
    archiveCount: (count: number) => `Отзывов в архиве объекта: ${count}`, archiveUnavailable: "Тексты отзывов сейчас недоступны.", firstTrail: "Поделитесь первым отзывом о маршруте", first: "Оставьте первый отзыв", firstTrailBody: "Расскажите о состоянии маршрута, сложности, людности, воде и других полезных деталях.", firstBody: "После проверки и одобрения отзыв появится здесь с выбранным именем и оценкой.",
    dialogTrail: "Полезный отзыв для путешественников", dialog: "Отзыв после посещения", close: "Закрыть", closeLabel: "Закрыть форму отзыва", successTitle: "Отзыв получен и ожидает проверки", successBody: "Отзыв и фотографии сохранены. На сайте появится только проверенный и одобренный контент.", done: "Готово", shortTrail: "Коротко о маршруте", short: "Коротко о ваших впечатлениях", displayName: "Имя для публикации", tripDate: "Дата похода", visitDate: "Дата посещения", yourRating: "Ваша оценка", trailRating: "Оценка маршрута", placeRating: "Оценка объекта", stars: (score: number) => `${score} из 5 звёзд`, outOfFive: (score: number, feedback: string) => `${score} из 5, ${feedback}`, ratingFeedback: ["Выберите оценку", "Плохо", "Нужно улучшить", "Хорошо", "Очень хорошо", "Отлично"], trailPrompt: "Что важно знать другим путешественникам?", placePrompt: "Что важно знать будущим гостям?",
    optional: "Добавить фото или подтверждение, необязательно", booking: "Номер бронирования, если есть", receipt: "Прикрепить подтверждение посещения", verificationOnly: "Только для проверки", choosePhotos: "Выбрать фотографии", upToPhotos: "До 8 фотографий", selectedPhoto: (index: number) => `Выбранное фото ${index}`, consent: "Я подтверждаю, что этот контент принадлежит мне и может быть проверен перед публикацией.", sending: "Отправляем отзыв и фотографии...", submit: "Отправить на проверку", privacy: "Контент и файлы безопасно сохраняются для проверки. До одобрения они не появятся на сайте.", genericError: "Не удалось отправить отзыв. Попробуйте ещё раз.", photoLimit: "Можно прикрепить до 8 фотографий",
  },
  fr: {
    trailTitle: "Avis des randonneurs sur ce parcours", title: (name: string) => `Avis sur ${name}`, trailButton: "Partager une information", button: "Écrire un avis", gallery: "Photos des clients",
    fieldNote: "Informations du terrain", moderation: "Chaque nouvel avis est vérifié avant sa publication.", illustrative: "Les avis de cette page sont fictifs et servent uniquement à illustrer le design.",
    outOfTen: (value: number) => `${value} sur 10`, published: (count: number) => `${count} avis publiés`, sourceScore: "Note de l’établissement", illustrativeScore: "Note et avis présentés à titre d’exemple",
    newLabel: "Nouveau", voice: "Votre expérience compte", noApproved: "Aucun avis approuvé n’a encore été publié sur cette page.", noText: "Cette note a été publiée sans commentaire.", response: "Réponse de l’établissement", archive: "Avis provenant des archives VII", original: "Avis affiché dans la langue de son auteur",
    more: (count: number) => `Afficher ${count} avis supplémentaires`, readMore: "Afficher l’avis complet", readLess: "Réduire l’avis", pending: "En attente de validation", photosAttached: (count: number) => `${count} photos jointes. `, pendingBody: "Votre avis a bien été reçu et sera vérifié. Il ne sera visible qu’après validation.",
    archiveCount: (count: number) => `${count} avis dans les archives de l’établissement`, archiveUnavailable: "Les avis écrits ne sont pas disponibles pour le moment.", firstTrail: "Partagez le premier retour sur ce parcours", first: "Soyez la première personne à donner votre avis", firstTrailBody: "Indiquez l’état du parcours, sa difficulté, l’affluence, les points d’eau et tout détail utile.", firstBody: "Après vérification et validation, votre avis apparaîtra ici avec le nom et la note choisis.",
    dialogTrail: "Une information utile aux randonneurs", dialog: "Votre avis après la visite", close: "Fermer", closeLabel: "Fermer le formulaire d’avis", successTitle: "Avis reçu et en attente de validation", successBody: "Votre avis et vos photos ont été enregistrés. Seul le contenu vérifié et validé sera publié.", done: "Terminer", shortTrail: "Partagez une information concise", short: "Racontez brièvement votre visite", displayName: "Nom affiché", tripDate: "Date de la randonnée", visitDate: "Date de la visite", yourRating: "Votre note", trailRating: "Note du parcours", placeRating: "Note de l’établissement", stars: (score: number) => `${score} étoiles sur 5`, outOfFive: (score: number, feedback: string) => `${score} sur 5, ${feedback}`, ratingFeedback: ["Choisissez une note", "Insuffisant", "À améliorer", "Bien", "Très bien", "Excellent"], trailPrompt: "Que doivent savoir les autres randonneurs ?", placePrompt: "Que doivent savoir les futurs clients ?",
    optional: "Ajouter des photos ou un justificatif, facultatif", booking: "Numéro de réservation, si disponible", receipt: "Joindre un justificatif de visite", verificationOnly: "Utilisé uniquement pour la vérification", choosePhotos: "Choisir des photos", upToPhotos: "Jusqu’à 8 photos", selectedPhoto: (index: number) => `Photo sélectionnée ${index}`, consent: "Je confirme que ce contenu m’appartient et qu’il peut être vérifié avant publication.", sending: "Envoi de l’avis et des photos...", submit: "Envoyer pour validation", privacy: "Votre contenu et vos fichiers sont conservés de manière sécurisée pour vérification. Ils ne seront pas publiés avant validation.", genericError: "L’envoi de votre avis a échoué. Veuillez réessayer.", photoLimit: "Vous pouvez joindre jusqu’à 8 photos",
  },
} as const;

export function GuestReviewStudio({
  placeName,
  subjectId,
  subjectType = "place",
  rating: publishedRating,
  reviewCount = 0,
  publishedReviews = [],
  supplierReviews = [],
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
  supplierReviews?: SupplierPlaceDetail["reviews"];
  open?: boolean;
  onClose?: () => void;
  onOpenGallery?: () => void;
  illustrative?: boolean;
}) {
  const { language } = useSiteLanguage();
  const copy = reviewCopy[language];
  const [localOpen, setLocalOpen] = useState(false);
  const [visibleSupplierReviews, setVisibleSupplierReviews] = useState(10);
  const [expandedReviewIds, setExpandedReviewIds] = useState<Set<string>>(new Set());
  const reviewRailId = `review-rail-${useId().replace(/:/g, "")}`;
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
      if (!response.ok) {
        setSubmitError(publicReviewError(payload.error, language, copy.genericError));
        return;
      }
      setPendingReview(payload.review);
      setFinished(true);
      form.reset();
      setRating(0);
      previews.forEach((url) => URL.revokeObjectURL(url));
      setPreviews([]);
    } catch {
      setSubmitError(copy.genericError);
    } finally {
      setSubmitting(false);
    }
  }

  function selectPhotos(event: ChangeEvent<HTMLInputElement>) {
    previews.forEach((url) => URL.revokeObjectURL(url));
    const files = Array.from(event.target.files || []).filter((file) => file.type.startsWith("image/")).slice(0, 8);
    if (event.target.files && event.target.files.length > 8) setSubmitError(copy.photoLimit);
    else setSubmitError("");
    setPreviews(files.map((file) => URL.createObjectURL(file)));
  }

  const title = isTrail ? copy.trailTitle : copy.title(placeName);
  const buttonLabel = isTrail ? copy.trailButton : copy.button;
  const ratingFeedback = copy.ratingFeedback[rating];

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
        {isTrail ? <span className="eyebrow">{copy.fieldNote}</span> : null}
        <h2 id="reviews-title">{title}</h2>
        <p>{illustrative ? copy.illustrative : copy.moderation}</p>
      </div>
      <div className="review-experience__actions">
        <button className="button primary" type="button" onClick={openDialog}>{buttonLabel}</button>
        {!isTrail && onOpenGallery ? <button className="button secondary" type="button" onClick={onOpenGallery}>{copy.gallery}</button> : null}
      </div>
    </div>

    <div className="review-experience__body">
      <aside className="review-experience__score">
        {publishedRating ? <><strong>{publishedRating}</strong><span aria-label={copy.outOfTen(publishedRating)}>★★★★★</span><small>{illustrative ? copy.illustrativeScore : reviewCount ? copy.published(reviewCount) : copy.sourceScore}</small></> : <><strong>{copy.newLabel}</strong><span>{copy.voice}</span><small>{copy.noApproved}</small></>}
      </aside>
      <div className="review-experience__list">
        {supplierReviews.length ? <div className="review-experience__published-wrap"><SliderRailControls railId={reviewRailId} label={title} itemSelector=":scope > .review-card" className="review-experience__controls" /><div id={reviewRailId} className="review-experience__published" data-horizontal-rail>
          {supplierReviews.slice(0, visibleSupplierReviews).map((review) => { const reviewKey = String(review.id); const reviewContentId = `review-content-${resolvedSubjectId}-${reviewKey}`.replace(/[^a-zA-Z0-9_-]/g, "-"); const expandable = Boolean((review.title?.length || 0) + (review.text?.length || 0) + (review.response?.length || 0) > 220 || review.response); const expanded = expandedReviewIds.has(reviewKey); return <article className={`review-card review-card--published${expandable ? " review-card--expandable" : ""}${expanded ? " is-expanded" : ""}`} key={review.id}>
            <header><div><strong lang="he" dir="rtl" data-no-translate>{review.author}</strong>{review.score ? <span aria-label={copy.outOfTen(review.score)}>{review.score}/10</span> : null}</div>{/^\d{4}-\d{2}-\d{2}$/.test(review.date) ? <time dateTime={review.date}>{new Intl.DateTimeFormat(language === "he" ? "he-IL" : language === "en" ? "en-GB" : language === "ru" ? "ru-RU" : "fr-FR").format(new Date(`${review.date}T12:00:00`))}</time> : null}</header>
            <div id={reviewContentId} className="review-card__original" lang="he" dir="rtl" data-no-translate>{review.title ? <strong>{review.title}</strong> : null}{review.text ? <p>{review.text}</p> : <p>{copy.noText}</p>}{review.response ? <div className="review-card__response"><strong>{copy.response}</strong><p>{review.response}</p></div> : null}</div>
            {expandable ? <button className="review-card__toggle" type="button" aria-controls={reviewContentId} aria-expanded={expanded} onClick={() => setExpandedReviewIds((current) => { const next = new Set(current); expanded ? next.delete(reviewKey) : next.add(reviewKey); return next; })}>{expanded ? copy.readLess : copy.readMore}</button> : null}
            <footer>{copy.archive}{language === "he" ? "" : ` · ${copy.original}`}</footer>
          </article>; })}
        </div>{visibleSupplierReviews < supplierReviews.length ? <button className="button secondary review-experience__more" type="button" onClick={() => setVisibleSupplierReviews((count) => Math.min(count + 10, supplierReviews.length))}>{copy.more(supplierReviews.length - visibleSupplierReviews)}</button> : null}</div> : publishedReviews.length ? <div className="review-experience__published-wrap"><SliderRailControls railId={reviewRailId} label={title} itemSelector=":scope > .review-card" className="review-experience__controls" /><div id={reviewRailId} className="review-experience__published" data-horizontal-rail>
          {publishedReviews.map((review) => <article className="review-card review-card--published" key={`${review.visitedAt}-${review.author.he}`}>
            <header><div><strong>{review.author[language]}</strong><span aria-label={`${review.rating} מתוך 10`}>{review.rating}/10</span></div><time dateTime={review.visitedAt}>{new Intl.DateTimeFormat(language === "he" ? "he-IL" : language === "en" ? "en-GB" : language === "ru" ? "ru-RU" : "fr-FR").format(new Date(`${review.visitedAt}T12:00:00`))}</time></header>
            <p>{review.summary[language]}</p>
            <footer>{illustrative ? (language === "he" ? "חוות דעת בדיונית להמחשת העיצוב, לא חוות דעת של אורח אמיתי" : language === "en" ? "Fictional review for design illustration, not a real guest review" : language === "ru" ? "Вымышленный отзыв для демонстрации дизайна, не отзыв реального гостя" : "Avis fictif pour illustrer le design, pas l’avis d’un véritable client") : (language === "he" ? "תמצית חוות דעת מאומתת מארכיון VII" : language === "en" ? "Summary of a verified review from the VII archive" : language === "ru" ? "Краткое содержание проверенного отзыва из архива VII" : "Résumé d’un avis vérifié provenant des archives VII")}</footer>
          </article>)}
        </div></div> : pendingReview ? <article className="review-card review-card--pending">
          <header><div><strong>{pendingReview.author}</strong><span>{"★".repeat(pendingReview.rating)}{"☆".repeat(5 - pendingReview.rating)}</span></div><small>{copy.pending}</small></header>
          <p>{pendingReview.body}</p>
          <footer>{pendingReview.photoCount ? copy.photosAttached(pendingReview.photoCount) : ""}{copy.pendingBody}</footer>
        </article> : reviewCount ? <div className="review-experience__empty"><strong>{copy.archiveCount(reviewCount)}</strong><p>{copy.archiveUnavailable}</p></div> : <div className="review-experience__empty">
          <strong>{isTrail ? copy.firstTrail : copy.first}</strong>
          <p>{isTrail ? copy.firstTrailBody : copy.firstBody}</p>
          <button type="button" onClick={openDialog}>{buttonLabel}</button>
        </div>}
      </div>
    </div>

    {isOpen ? <div className="review-studio" role="dialog" aria-modal="true" aria-label={buttonLabel} onMouseDown={(event) => event.target === event.currentTarget && closeDialog()}>
      <form className="review-studio__panel" onSubmit={submitReview}>
        <header><div><span>{isTrail ? copy.dialogTrail : copy.dialog}</span><h2>{placeName}</h2></div><button type="button" onClick={closeDialog} aria-label={copy.closeLabel}>{copy.close}</button></header>
        {finished ? <div className="review-studio__success" role="status"><span>✓</span><h3>{copy.successTitle}</h3><p>{copy.successBody}</p><button className="button secondary" type="button" onClick={closeDialog}>{copy.done}</button></div> : <>
          <section className="review-studio__main"><span className="review-studio__step">1</span><div><h3>{isTrail ? copy.shortTrail : copy.short}</h3><div className="review-studio__identity"><label>{copy.displayName}<input name="author" type="text" minLength={2} required /></label><label>{isTrail ? copy.tripDate : copy.visitDate}<input name="visitDate" type="date" max={new Date().toISOString().slice(0, 10)} required /></label></div><div className="review-rating-field"><span className="review-rating-field__label">{copy.yourRating}</span><div className="rating-picker" role="radiogroup" aria-label={isTrail ? copy.trailRating : copy.placeRating}>{[1,2,3,4,5].map((score) => <button key={score} data-score={score} className={score <= rating ? "is-filled" : ""} type="button" role="radio" aria-checked={rating === score} tabIndex={rating === score || (!rating && score === 1) ? 0 : -1} onClick={() => setRating(score)} onKeyDown={(event) => handleRatingKeyDown(event, score)} aria-label={copy.stars(score)}><span aria-hidden="true">★</span></button>)}</div><output className={rating ? "is-selected" : ""} aria-live="polite">{rating ? copy.outOfFive(rating, ratingFeedback) : ratingFeedback}</output></div><label>{isTrail ? copy.trailPrompt : copy.placePrompt}<textarea name="review" required rows={4} minLength={20} /></label></div></section>
          <details className="review-studio__optional"><summary>{copy.optional}</summary><div>{!isTrail ? <><label>{copy.booking}<input name="booking" /></label><label className="review-upload"><input name="receipt" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf" /><span>{copy.receipt}</span><small>{copy.verificationOnly}</small></label></> : null}<label className="review-upload review-upload--photos"><input ref={photoInputRef} name="photos" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple onChange={selectPhotos} /><span>{copy.choosePhotos}</span><small>{copy.upToPhotos}</small></label>{previews.length ? <div className="review-preview">{previews.map((url, index) => <img key={url} src={url} alt={copy.selectedPhoto(index + 1)} title={copy.selectedPhoto(index + 1)} />)}</div> : null}</div></details>
          <label className="review-consent"><input name="consent" value="yes" required type="checkbox" /><span>{copy.consent}</span></label>
          {submitError ? <p className="review-studio__error" role="alert">{submitError}</p> : null}
          <button className="button primary wide" type="submit" disabled={!rating || submitting} aria-busy={submitting}>{submitting ? copy.sending : copy.submit}</button>
          <p className="review-studio__notice">{copy.privacy}</p>
        </>}
      </form>
    </div> : null}
  </section>;
}
