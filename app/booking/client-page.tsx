"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useId, useRef, useState } from "react";
import { CalendarIcon } from "../site-header";
import { saveBooking } from "../lib/account";
import { SpaAppointmentPicker } from "../components/spa-appointment-picker";
import { useSiteLanguage } from "../i18n/locale-provider";
import { localizedPath } from "../i18n/locale-routing";
import { AccountFormPrompt, useAccountAccess } from "../components/account-access";
import { BookingSchedulePicker } from "../components/booking-schedule-picker";
import { ViewedItemTracker } from "../components/viewed-item-tracker";

type Props = {
  world: string;
  placeId: string;
  placeName: string;
  offerId: string;
  offerName: string;
  offerAudience?: string;
  offerDuration?: string;
  offerIncludes?: string[];
  price: string;
  action: string;
  initialFrom?: string;
  initialTill?: string;
  initialGuests?: string;
  onlineReady?: boolean;
  phone?: string;
  illustrative?: boolean;
  demoOwnerEmail?: string;
  demoProperty?: boolean;
  placeImage?: string;
  vacationPrice?: {
    nightlyPrice: number;
    nights: number;
    totalPrice: number;
    guests: number;
    wholeProperty: boolean;
    taxesIncluded: boolean;
  };
};

const priceCopy = {
  he: { total: "סה״כ לכל השהייה", night: "ללילה", nights: "לילות", oneNight: "לילה אחד", whole: "כל הווילה", guests: "אורחים", taxIncluded: "כולל מע״מ וכל מס חובה", taxPending: "מסים ותוספות יוצגו לפני האישור" },
  en: { total: "Total for the entire stay", night: "per night", nights: "nights", oneNight: "one night", whole: "entire villa", guests: "guests", taxIncluded: "VAT and all mandatory taxes included", taxPending: "Taxes and fees will be shown before confirmation" },
  ru: { total: "Итого за всё проживание", night: "за ночь", nights: "ночей", oneNight: "одна ночь", whole: "вся вилла", guests: "гостей", taxIncluded: "НДС и все обязательные налоги включены", taxPending: "Налоги и сборы будут показаны до подтверждения" },
  fr: { total: "Total pour l’ensemble du séjour", night: "par nuit", nights: "nuits", oneNight: "une nuit", whole: "villa entière", guests: "voyageurs", taxIncluded: "TVA et toutes les taxes obligatoires incluses", taxPending: "Les taxes et frais seront affichés avant confirmation" },
} as const;

function countStayNights(from: string, till: string) {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${till}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.round((end - start) / 86_400_000);
}

export default function BookingPageClient(props: Props) {
  const { language, translate } = useSiteLanguage();
  const { account } = useAccountAccess();
  const formRef = useRef<HTMLFormElement>(null);
  const paymentTriggerRef = useRef<HTMLButtonElement>(null);
  const paymentDialogRef = useRef<HTMLElement>(null);
  const paymentTitleId = useId();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [state, setState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [reference, setReference] = useState("");
  const [submissionId, setSubmissionId] = useState("");
  const [spaAppointmentReady, setSpaAppointmentReady] = useState(false);
  const [phoneRevealed, setPhoneRevealed] = useState(false);
  const [arrival, setArrival] = useState(props.initialFrom || "");
  const [departure, setDeparture] = useState(props.initialTill || "");
  const [preferredTime, setPreferredTime] = useState("");
  const [scheduleError, setScheduleError] = useState("");
  const [guests, setGuests] = useState(() => props.world === "spa" ? props.offerAudience === "יחיד" ? "1" : props.offerAudience === "קבוצה" ? "3" : props.offerAudience === "זוג" ? "2" : props.initialGuests || "2" : props.initialGuests || "2");
  const [spaComposition, setSpaComposition] = useState("");
  const [spaTime, setSpaTime] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"pay_now" | "pay_at_venue" | "">("");
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [successExplanationOpen, setSuccessExplanationOpen] = useState(false);
  const demoReference = props.demoProperty ? "PALUMBO-DEMO" : "DEMO";
  const isManage = props.action === "manage";
  const onlineReady = props.world !== "vacation" || Boolean(props.onlineReady);
  const usesSpaPayment = props.world === "spa" && !isManage;
  const localizedOfferIncludes = props.offerIncludes?.map((item) => translate(item));
  const paymentMethodLabel = paymentMethod === "pay_now" ? "תשלום בכרטיס עכשיו" : "תשלום במקום, כרטיס לביטחון";
  const currentNights = props.vacationPrice ? countStayNights(arrival, departure) || props.vacationPrice.nights : 0;
  const currentTotal = props.vacationPrice ? props.vacationPrice.nightlyPrice * currentNights : 0;
  const pricing = props.vacationPrice;
  const labels = priceCopy[language];
  const returnCopy = {
    he: { business: "חזרה לפרטי המקום", site: "חזרה לדף הבית", label: "חזרה לפרטי המקום" },
    en: { business: "Back to", site: "Back to site", label: "Leave booking" },
    ru: { business: "Вернуться к", site: "Вернуться на сайт", label: "Выйти из бронирования" },
    fr: { business: "Retour à", site: "Retour au site", label: "Quitter la réservation" },
  }[language];
  const businessReturnParams = new URLSearchParams({ id: props.placeId });
  if (props.world) businessReturnParams.set("world", props.world);
  if (arrival) businessReturnParams.set("from", arrival);
  if (departure) businessReturnParams.set("till", departure);
  if (guests) businessReturnParams.set("guests", guests);
  if (props.vacationPrice?.nightlyPrice) businessReturnParams.set("price", String(props.vacationPrice.nightlyPrice));
  if (props.illustrative) businessReturnParams.set("illustrative", "1");
  const businessReturnHref = localizedPath(`/business?${businessReturnParams.toString()}`, language);
  const viewedOfferParams = new URLSearchParams({ world: props.world, place: props.placeId });
  if (props.offerId) viewedOfferParams.set("package", props.offerId);
  if (props.initialFrom) viewedOfferParams.set("from", props.initialFrom);
  if (props.initialTill) viewedOfferParams.set("till", props.initialTill);
  if (props.initialGuests) viewedOfferParams.set("guests", String(props.initialGuests));
  const viewedOfferHref = `/booking?${viewedOfferParams.toString()}`;
  const viewedOfferTracker = props.world === "spa" && props.offerId
    ? <ViewedItemTracker id={`${props.placeId}:${props.offerId}`} world="spa" name={`${props.offerName}, ${props.placeName}`} location={props.placeName} image={props.placeImage} href={viewedOfferHref} meta={props.price} />
    : null;
  const translatedPlaceName = translate(props.placeName);
  const bookingReturnNavigation = <nav className="booking-return-nav" aria-label={returnCopy.label} data-keep-same-tab="true">
    <Link className="booking-return-nav__business" href={businessReturnHref}>
      <span aria-hidden="true">‹</span>
      <strong>{returnCopy.business}<small>{translatedPlaceName}</small></strong>
    </Link>
    <Link className="booking-return-nav__site" href={localizedPath("/", language)}>{returnCopy.site}</Link>
  </nav>;
  const vacationPriceSummary = pricing ? <div className="booking-price-breakdown" aria-label={labels.total}>
    <span>{labels.total}</span>
    <strong>{currentTotal.toLocaleString(language === "he" ? "he-IL" : language)} ₪</strong>
    <small>{pricing.nightlyPrice.toLocaleString(language === "he" ? "he-IL" : language)} ₪ {labels.night} × {currentNights === 1 ? labels.oneNight : `${currentNights} ${labels.nights}`}</small>
    <small>{pricing.wholeProperty ? `${labels.whole} · ` : ""}{guests} {labels.guests}</small>
    <em>{pricing.taxesIncluded ? labels.taxIncluded : labels.taxPending}</em>
  </div> : null;

  useEffect(() => {
    if (!account) return;
    const timer = window.setTimeout(() => {
      setName(account.name);
      setPhone(account.phone || "");
      setEmail(account.email);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [account]);

  const closePayment = useCallback(() => {
    if (state === "submitting") return;
    setPaymentOpen(false);
    requestAnimationFrame(() => paymentTriggerRef.current?.focus());
  }, [state]);

  useEffect(() => {
    if (!paymentOpen && !successExplanationOpen) return;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (paymentOpen) closePayment();
        else setSuccessExplanationOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(paymentDialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled]), a[href]") || []);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    requestAnimationFrame(() => paymentDialogRef.current?.querySelector<HTMLElement>("button:not([disabled])")?.focus());
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [closePayment, paymentOpen, successExplanationOpen]);
  function validateStep(currentStep: 1 | 2) {
    const section = formRef.current?.querySelector<HTMLElement>(`[data-booking-step="${currentStep}"]`);
    const controls = Array.from(section?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input, textarea, select") || []);
    const invalid = controls.find((control) => !control.checkValidity());
    if (invalid) {
      invalid.reportValidity();
      invalid.focus();
      return false;
    }
    if (currentStep === 1 && props.world === "spa" && !spaAppointmentReady) return false;
    if (currentStep === 1 && props.world !== "spa" && (!arrival || (props.world === "vacation" && !departure))) {
      setScheduleError(props.world === "vacation" ? "בחרו תאריך הגעה ועזיבה." : "בחרו תאריך.");
      return false;
    }
    if (currentStep === 1) setScheduleError("");
    return true;
  }

  function nextStep(currentStep: 1 | 2) {
    if (!validateStep(currentStep)) return;
    setStep(currentStep === 1 ? 2 : 3);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openPayment() {
    if (!paymentMethod) {
      formRef.current?.querySelector<HTMLInputElement>('input[name="paymentMethod"]')?.focus();
      return;
    }
    setPaymentOpen(true);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (props.illustrative) { setReference(demoReference); setState("success"); return; }
    if (step !== 3 || state === "submitting" || state === "success") return;
    setState("submitting");
    const values = new FormData(event.currentTarget);
    const id = submissionId || crypto.randomUUID();
    if (!submissionId) setSubmissionId(id);
    const details = [
      `מקום או ספק: ${props.placeName}`,
      `שירות או חבילה: ${props.offerName}`,
      values.get("date") ? `תאריך: ${values.get("date")}` : "",
      values.get("till") ? `תאריך עזיבה: ${values.get("till")}` : "",
      values.get("time") ? `שעה: ${values.get("time")}` : "",
      values.get("guests") ? `כמות משתתפים: ${values.get("guests")}` : "",
      values.get("spaCompositionLabel") ? `הרכב המטופלים: ${values.get("spaCompositionLabel")}` : "",
      usesSpaPayment ? `אופן התשלום שנבחר: ${paymentMethodLabel}` : "",
      props.offerDuration ? `משך הטיפול: ${props.offerDuration}` : "",
      props.offerIncludes?.length ? `מה כלול: ${props.offerIncludes.join(", ")}` : "",
      values.get("notes") ? `הערות: ${values.get("notes")}` : "",
    ].filter(Boolean).join("\n");

    try {
      const response = await fetch("/api/leads/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: id,
          purpose: isManage ? "booking-management" : "booking",
          world: props.world,
          name: values.get("name"),
          phone: values.get("phone"),
          email: values.get("email"),
          organization: props.placeName,
          package: props.offerId || undefined,
          message: details,
          honey: values.get("company_site"),
          privacyAccepted: values.get("privacy") === "on",
          sourcePage: window.location.href,
        }),
      });
      const result = await response.json() as { success?: boolean; reference?: string };
      if (!response.ok || !result.success) throw new Error("booking failed");
      if (!isManage) saveBooking({ id, reference: result.reference, world: props.world, placeName: props.placeName, offerName: props.offerName, date: [values.get("date"), values.get("till")].filter(Boolean).join(" עד "), guests: String(values.get("guests") || ""), status: "pending", createdAt: new Date().toISOString() });
      setReference(result.reference || "");
      setPaymentOpen(false);
      setState("success");
      if (usesSpaPayment) setSuccessExplanationOpen(true);
    } catch {
      setState("error");
    }
  }

  if (!onlineReady) return <main id="main-content" className="booking-page shell">
    {viewedOfferTracker}
    {bookingReturnNavigation}
    <section className="booking-unavailable" aria-labelledby="booking-phone-title">
      <span className="eyebrow">הזמנה בטלפון</span>
      <h1 id="booking-phone-title">חסר תאריך או מחיר להזמנה מקוונת</h1>
      <p>כדי לא להציג הזמנה חלקית, ממשיכים בשיחה ישירה עם המקום. לאחר חיבור המערכת נתוני התאריך והמחיר יגיעו אוטומטית.</p>
      {props.phone ? phoneRevealed ? <a className="phone-reveal phone-reveal--visible" href={`tel:${props.phone.replace(/[^\d+]/g, "")}`}><span>לחיוג עכשיו</span><strong dir="ltr">{props.phone}</strong></a> : <button className="phone-reveal" type="button" onClick={() => setPhoneRevealed(true)} aria-expanded={phoneRevealed}><span>טלפון להזמנה</span><strong>לחצו להצגת המספר</strong></button> : <p role="status">מספר ההזמנות טרם חובר למקום.</p>}
      <span data-keep-same-tab="true"><Link className="button secondary" href={businessReturnHref}>{returnCopy.business}</Link></span>
    </section>
  </main>;

  if (state === "success") return <>
    <main id="main-content" className="booking-page shell">
      {viewedOfferTracker}
      {bookingReturnNavigation}
      <section className="booking-success" role="status" aria-live="polite">
        <span className="booking-success__mark" aria-hidden="true">✓</span>
        <small>{props.illustrative ? "המחשת הזמנה בלבד" : isManage ? "בקשת שינוי" : "הזמנה שממתינה לאישור"}</small>
        <h1>{props.illustrative ? "המחשת ההזמנה הושלמה" : isManage ? "בקשת השינוי התקבלה" : "בקשת ההזמנה הושלמה"}</h1>
        <p>{props.illustrative ? "זו המחשת תצוגה בלבד. לא נשלחה הזמנה, לא נשמרו פרטים ולא בוצע חיוב." : isManage ? "הבקשה נשמרה ונציג יבדוק אותה." : usesSpaPayment ? paymentMethod === "pay_now" ? "פרטי ההזמנה נשמרו. ספק הסליקה טרם חובר ולכן לא בוצע חיוב בכרטיס." : "פרטי ההזמנה נשמרו. לא בוצע חיוב, וכרטיס לביטחון לא נשמר עד לחיבור ספק סליקה מאובטח." : "לא בוצע חיוב. המקום יקבל את הבקשה, יאמת זמינות ומחיר ויחזיר אישור סופי."}</p>
        <div className="booking-success__summary">
          <strong>{props.placeName}</strong>
          <span>{arrival}{departure ? " עד " + departure : ""}</span>
          <span>{props.world === "spa" ? guests + " משתתפים" + (spaComposition ? ", " + spaComposition : "") : guests + " אורחים"}</span>
          {usesSpaPayment ? <span>{paymentMethodLabel}</span> : null}
          <b>{props.price}</b>
          {reference ? <code dir="ltr">{reference}</code> : null}
        </div>
        <div className="booking-success__actions"><button className="button secondary" type="button" onClick={() => window.print()}>הדפסת הסיכום</button><Link className="button primary" href="/account">לצפייה בהזמנות שלי</Link><Link className="button subtle" href="/">חזרה לדף הבית</Link></div>
      </section>
      {props.demoProperty ? <section className="booking-notification-preview" aria-labelledby="booking-notification-preview-title">
        <header>
          <span className="eyebrow">תצוגה מקדימה בלבד</span>
          <h2 id="booking-notification-preview-title">מה הלקוח ובעל המקום היו מקבלים</h2>
          <p>ההודעות הבאות לא נשלחו. הן מציגות את התוכן והיעדים הדרושים לפני חיבור ספקי מייל, מסרונים ווואטסאפ מאומתים.</p>
        </header>
        <div className="booking-notification-preview__grid">
          <article><small>לקוח, מייל</small><strong>{email || "כתובת מלאה טרם נמסרה"}</strong><p>התקבלה בקשת הזמנה לוילה פלומבו. התאריכים, האורחים והמחיר נשמרו בהמחשה, ללא חיוב.</p><em>לא נשלח</em></article>
          <article><small>לקוח, מסרון</small><strong dir="ltr">{phone || "מספר טרם נמסר"}</strong><p>בקשת ההזמנה התקבלה. מספר ההמחשה הוא PALUMBO-DEMO.</p><em>לא נשלח</em></article>
          <article><small>לקוח, וואטסאפ</small><strong dir="ltr">{phone || "מספר טרם נמסר"}</strong><p>סיכום קצר עם שם המקום, התאריכים, המחיר וקישור לצפייה בהזמנה.</p><em>לא נשלח</em></article>
          <article><small>בעל המקום, מייל</small><strong dir="ltr">{props.demoOwnerEmail || "adir@wplus.co.il"}</strong><p>התקבלה הזמנה חדשה עם פרטי הלקוח, התאריכים, ההרכב והמחיר שנבחר.</p><em>לא נשלח</em></article>
          <article><small>בעל המקום, מסרון</small><strong>מספר בעל המקום טרם נמסר</strong><p>התראה קצרה על הזמנה חדשה וקישור למערכת הניהול.</p><em>לא נשלח</em></article>
          <article><small>בעל המקום, וואטסאפ</small><strong>מספר בעל המקום טרם נמסר</strong><p>כרטיס הזמנה מסודר עם אפשרות לצפות, לאשר או ליצור קשר עם הלקוח.</p><em>לא נשלח</em></article>
        </div>
      </section> : null}
    </main>
    {successExplanationOpen ? <div className="booking-payment-layer" onMouseDown={(event) => event.target === event.currentTarget && setSuccessExplanationOpen(false)}>
      <section ref={paymentDialogRef} className="booking-payment-dialog booking-payment-dialog--success" role="dialog" aria-modal="true" aria-labelledby={paymentTitleId}>
        <span className="booking-payment-dialog__mark" aria-hidden="true">✓</span>
        <small>סיכום הזמנה</small>
        <h2 id={paymentTitleId}>הבקשה נשמרה בהצלחה</h2>
        <p>{paymentMethod === "pay_now" ? "בחרתם לשלם בכרטיס עכשיו. בשלב ההמחשה לא בוצע חיוב, ופרטי כרטיס לא נאספו." : "בחרתם לשלם במקום ולהעמיד כרטיס לביטחון. בשלב ההמחשה לא נשמר כרטיס ולא בוצע חיוב."}</p>
        <div className="booking-payment-dialog__summary"><span>{props.placeName}</span><strong>{props.price}</strong><small>{paymentMethodLabel}</small></div>
        <button className="button primary wide" type="button" onClick={() => setSuccessExplanationOpen(false)}>הבנתי, לסיכום ההזמנה</button>
      </section>
    </div> : null}
  </>;
  return <main id="main-content" className="booking-page shell">
    {viewedOfferTracker}
    {bookingReturnNavigation}
    <div className="booking-page__intro">
      <span className="eyebrow">{isManage ? "ניהול הזמנה" : usesSpaPayment ? "הזמנת ספא אונליין" : "הזמנה אונליין"}</span>
      <h1>{isManage ? "עדכון או ביטול הזמנה" : props.placeName}</h1>
      <p>{props.illustrative ? "כך ייראה מסלול ההזמנה כאשר המחיר והזמינות יחוברו למערכת. ההמחשה אינה שולחת הזמנה." : isManage ? "מוסרים את מספר ההזמנה ואת הבקשה המבוקשת." : usesSpaPayment ? "בוחרים מועד, ממלאים פרטים ובוחרים איך לשלם לפני סיכום ההזמנה." : "שלושה שלבים קצרים. הבקשה נשלחת לאישור המקום ורק לאחר מכן הופכת להזמנה מאושרת."}</p>
    </div>

    <nav className="booking-steps" aria-label="שלבי ההזמנה">
      {[1, 2, 3].map((number) => <button key={number} type="button" className={step === number ? "active" : step > number ? "complete" : ""} aria-current={step === number ? "step" : undefined} onClick={() => number < step && setStep(number as 1 | 2 | 3)}><b>{number}</b><span>{number === 1 ? "פרטי השהייה" : number === 2 ? "פרטי המזמין" : usesSpaPayment ? "תשלום וסיכום" : "סיכום ושליחה"}</span></button>)}
    </nav>

    <div className="booking-flow booking-flow--steps">
      <aside className="booking-summary">
        <CalendarIcon />
        <small>מה מזמינים</small>
        <h2>{props.offerName}</h2>
        <strong>{props.placeName}</strong>
        {vacationPriceSummary || <p>{props.price}</p>}
        {props.world === "spa" ? <dl className="booking-summary__package">
          {props.offerAudience ? <div><dt>מתאים ל</dt><dd>{props.offerAudience}</dd></div> : null}
          {props.offerDuration ? <div><dt>משך הטיפול</dt><dd>{props.offerDuration}</dd></div> : null}
          {localizedOfferIncludes?.length ? <div><dt>מה כלול</dt><dd>{localizedOfferIncludes.join(" · ")}</dd></div> : null}
        </dl> : null}
        <ul>{usesSpaPayment ? <><li>בוחרים תשלום עכשיו או במקום</li><li>הכרטיס מוזן רק בחלון סליקה מאובטח</li><li>בשלב ההמחשה לא נאספים פרטי כרטיס</li></> : <><li>אין הזנת כרטיס אשראי</li><li>הבקשה נשמרת בסטטוס ממתין</li><li>אישור סופי מתקבל לאחר בדיקת המקום</li></>}</ul>
      </aside>

      <form ref={formRef} className="booking-form booking-form--steps" onSubmit={submit}>
        <section data-booking-step="1" hidden={step !== 1} aria-labelledby="booking-step-one-title">
          <header><span>שלב 1 מתוך 3</span><h2 id="booking-step-one-title">פרטי השהייה</h2></header>
          {isManage ? <label className="form-wide">מספר הזמנה<input name="bookingReference" required /></label> : <>
            {props.world === "spa" ? <SpaAppointmentPicker initialDate={props.initialFrom} initialGuests={props.initialGuests} offerName={props.offerName} offerAudience={props.offerAudience} offerDuration={props.offerDuration} onSelectionChange={(selection) => {
              setSpaAppointmentReady(selection.ready);
              setArrival(selection.date);
              setGuests(String(selection.guests));
              setSpaComposition(selection.compositionLabel);
              setSpaTime(selection.time);
            }} /> : <BookingSchedulePicker range={props.world === "vacation"} arrival={arrival} departure={departure} time={preferredTime} onArrivalChange={(value) => { setArrival(value); setScheduleError(""); }} onDepartureChange={(value) => { setDeparture(value); setScheduleError(""); }} onTimeChange={(value) => { setPreferredTime(value); setScheduleError(""); }} />}
            {props.world !== "spa" && scheduleError ? <p className="booking-form__schedule-error form-wide" role="alert">{translate(scheduleError)}</p> : null}
            {props.world !== "spa" ? <label>כמות אורחים או משתתפים<input name="guests" type="number" min="1" value={guests} onChange={(event) => setGuests(event.target.value)} required /></label> : null}
          </>}
          <div className="booking-form__actions form-wide"><button className="button primary" type="button" onClick={() => nextStep(1)}>המשך לפרטי המזמין</button></div>
          {!isManage && props.world === "spa" && !spaAppointmentReady ? <p className="booking-form__hint form-wide" role="status">בחרו הרכב, תאריך ושעה כדי להמשיך.</p> : null}
        </section>

        <section data-booking-step="2" hidden={step !== 2} aria-labelledby="booking-step-two-title">
          <header><span>שלב 2 מתוך 3</span><h2 id="booking-step-two-title">פרטי המזמין</h2></header>
          <div className="form-wide"><AccountFormPrompt /></div>
          <label>שם מלא<input name="name" autoComplete="name" minLength={2} value={name} onChange={(event) => setName(event.target.value)} required /></label>
          <label>טלפון<input name="phone" type="tel" inputMode="tel" autoComplete="tel" minLength={7} value={phone} onChange={(event) => setPhone(event.target.value)} required /></label>
          <label>דואר אלקטרוני<input name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label className="form-wide">{isManage ? "מה תרצו לעדכן?" : "בקשות מיוחדות"}<textarea name="notes" rows={4} maxLength={1500} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
          <label className="form-honey" aria-hidden="true">אתר החברה<input name="company_site" tabIndex={-1} autoComplete="off" /></label>
          <label className="consent legal-consent form-wide"><input name="privacy" type="checkbox" required /><span>קראתי והסכמתי ל<Link href="/legal/terms">תקנון האתר</Link> ול<Link href="/legal/privacy">מדיניות הפרטיות</Link>, ואני מאשר או מאשרת שימוש בפרטים לצורך הטיפול בהזמנה.</span></label>
          <div className="booking-form__actions form-wide"><button className="button secondary" type="button" onClick={() => setStep(1)}>חזרה</button><button className="button primary" type="button" onClick={() => nextStep(2)}>המשך לסיכום</button></div>
        </section>

        <section data-booking-step="3" hidden={step !== 3} aria-labelledby="booking-step-three-title">
          <header><span>שלב 3 מתוך 3</span><h2 id="booking-step-three-title">{usesSpaPayment ? "סיכום ואופן התשלום" : "סיכום ושליחת הבקשה"}</h2></header>
          <div className="booking-review form-wide">
            <article><span>מקום וחבילה</span><strong>{props.placeName}</strong><small>{props.offerName}{props.offerDuration ? " · " + props.offerDuration : ""}</small></article>
            <article><span>מועד והרכב</span><strong>{arrival || "לפי הבחירה"}{spaTime ? " בשעה " + spaTime : departure ? " עד " + departure : ""}</strong><small>{props.world === "spa" ? guests + " משתתפים" + (spaComposition ? ", " + spaComposition : "") : guests + " אורחים או משתתפים"}</small></article>
            <article><span>פרטי המזמין</span><strong>{name}</strong><small>{phone}{email ? " · " + email : ""}</small></article>
            <article className={pricing ? "booking-review__price" : undefined}><span>מחיר ההזמנה</span>{vacationPriceSummary || <strong>{props.price}</strong>}<small>{usesSpaPayment ? paymentMethod ? paymentMethodLabel : "אופן התשלום ייבחר כעת" : "ללא חיוב וללא אשראי בשלב זה"}</small></article>
          </div>
          {usesSpaPayment ? <fieldset className="booking-payment-choice form-wide">
            <legend>איך תרצו לשלם?</legend>
            <p>בחרו את אופן התשלום המתאים לכם.</p>
            <div>
              <label><input type="radio" name="paymentMethod" value="pay_now" checked={paymentMethod === "pay_now"} onChange={() => setPaymentMethod("pay_now")} required /><span><b>תשלום בכרטיס אשראי עכשיו</b><small>מעבר לחלון תשלום מאובטח עבור מלוא סכום ההזמנה.</small></span></label>
              <label><input type="radio" name="paymentMethod" value="pay_at_venue" checked={paymentMethod === "pay_at_venue"} onChange={() => setPaymentMethod("pay_at_venue")} required /><span><b>תשלום במקום</b><small>הכרטיס משמש לביטחון ההזמנה בלבד ואינו מחויב עכשיו.</small></span></label>
            </div>
            <small className="booking-payment-choice__notice">ספק הסליקה טרם חובר. כרגע זהו תהליך המחשה, אין להזין או לשמור פרטי כרטיס אמיתי.</small>
          </fieldset> : <div className="booking-approval-note form-wide"><strong>מה קורה אחרי השליחה?</strong><p>הבקשה נשמרת ומועברת למקום. לאחר בדיקת הזמינות והמחיר יישלח אישור סופי. עד אז הסטטוס הוא ממתין לאישור.</p></div>}
          <div className="booking-form__actions form-wide">
            <button className="button secondary" type="button" onClick={() => setStep(2)}>עריכת הפרטים</button>
            {usesSpaPayment ? <button ref={paymentTriggerRef} className="button primary" type="button" onClick={openPayment}>המשך לתשלום</button> : <button className="button primary" disabled={state === "submitting"} type="submit">{state === "submitting" ? "שולחים..." : props.illustrative ? "סיום המחשת ההזמנה" : isManage ? "שליחת בקשת שינוי" : "שליחת בקשת הזמנה"}</button>}
          </div>
          {state === "error" ? <p className="form-error form-wide" role="alert">השליחה לא הושלמה. הפרטים נשארו בטופס ואפשר לנסות שוב.</p> : null}
        </section>
      </form>
    </div>
    {paymentOpen ? <div className="booking-payment-layer" onMouseDown={(event) => event.target === event.currentTarget && closePayment()}>
      <section ref={paymentDialogRef} className="booking-payment-dialog" role="dialog" aria-modal="true" aria-labelledby={paymentTitleId}>
        <header><div><small>תשלום מאובטח</small><h2 id={paymentTitleId}>{paymentMethod === "pay_now" ? "תשלום בכרטיס אשראי" : "כרטיס לביטחון ההזמנה"}</h2></div><button className="dialog-close" type="button" onClick={closePayment} aria-label="סגירת חלון התשלום">×</button></header>
        <p>{paymentMethod === "pay_now" ? "כאן יוזנו פרטי הכרטיס לצורך תשלום מלוא סכום ההזמנה." : "כאן יוזנו פרטי הכרטיס לביטחון בלבד. התשלום יתבצע במקום."}</p>
        <div className="booking-payment-dialog__card" aria-label="המחשת טופס כרטיס אשראי">
          <span>VII SECURE</span><b dir="ltr">•••• •••• •••• ••••</b><div><small>MM/YY</small><small>CVC</small></div>
        </div>
        <div className="booking-payment-dialog__notice" role="note"><strong>המחשה בלבד</strong><span>ספק סליקה מאובטח עדיין לא חובר. החלון אינו מבקש, שולח או שומר מספר כרטיס אמיתי.</span></div>
        <div className="booking-payment-dialog__summary"><span>{paymentMethodLabel}</span><strong>{props.price}</strong><small>{props.placeName}</small></div>
        <footer><button className="button secondary" type="button" onClick={closePayment}>חזרה</button><button className="button primary" type="button" aria-busy={state === "submitting"} disabled={state === "submitting"} onClick={() => formRef.current?.requestSubmit()}>{state === "submitting" ? "משלימים את ההזמנה..." : paymentMethod === "pay_now" ? "אישור תשלום והמשך" : "אישור כרטיס לביטחון והמשך"}</button></footer>
        {state === "error" ? <p className="form-error" role="alert">ההזמנה לא נשמרה. אפשר לסגור ולנסות שוב בלי לאבד את הפרטים.</p> : null}
      </section>
    </div> : null}  </main>;
}
