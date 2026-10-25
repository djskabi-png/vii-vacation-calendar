"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSiteLanguage } from "./i18n/locale-provider";
import { CalendarIcon } from "./site-header";
import { SearchWorldTabs } from "./components/world-switcher";
import { assessCalendarStay, stayCalendarDay, type StayCalendar } from "./lib/vii-stay-calendar.ts";

export type CalendarMode = "home" | "business";
export type BusinessKind = "multi" | "single";

type Availability = {
  kind: "past" | "busy" | "limited" | "open";
  units: number;
  label: string;
  unknown?: boolean;
};

type CalendarResult = {
  checkIn: string | null;
  checkOut: string | null;
  flexible: boolean;
  summary: string;
  flexibleStay: "weekend" | "long-weekend" | "week" | "month" | null;
  flexibleMonth: string | null;
  flexibleDays: number | null;
};

const DAY_MS = 86_400_000;
const SITE_TIME_ZONE = "Asia/Jerusalem";

export function currentSiteDay(reference = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SITE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(reference);
  const value = (type: "year" | "month" | "day") => Number(parts.find((part) => part.type === type)?.value);
  return new Date(value("year"), value("month") - 1, value("day"));
}

const DEMO_TODAY = currentSiteDay();
const START_MONTH = new Date(DEMO_TODAY.getFullYear(), DEMO_TODAY.getMonth(), 1);
const BUSINESS_BUSY_DATES = new Set([
  "2026-08-10",
  "2026-08-11",
  "2026-08-18",
  "2026-08-19",
  "2026-08-23",
  "2026-08-31",
  "2026-09-01",
  "2026-09-07",
]);

const BUSINESS_LIMITED_DATES = new Set([
  "2026-08-05",
  "2026-08-06",
  "2026-08-12",
  "2026-08-13",
  "2026-08-24",
  "2026-08-25",
  "2026-09-08",
  "2026-09-09",
]);

const BUSINESS_THREE_UNITS = new Set([
  "2026-08-17",
  "2026-08-28",
  "2026-09-28",
  "2026-09-29",
  "2026-09-30",
]);

const QUICK_STAYS = [
  { id: "weekend", label: "סוף השבוע הקרוב", nights: 2, preferredDay: 4 },
  { id: "midweek", label: "אמצע השבוע", nights: 3, preferredDay: 0 },
  { id: "week", label: "שבוע מלא", nights: 7, preferredDay: 0 },
] as const;

const FLEX_STAYS = [
  { id: "weekend", label: "סוף שבוע", nights: 2 },
  { id: "long-weekend", label: "סוף שבוע ארוך", nights: 3 },
  { id: "week", label: "שבוע", nights: 7 },
  { id: "month", label: "חודש", nights: 30 },
] as const;

function keyOf(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateFromKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function daysInMonth(month: Date) {
  return new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
}

function monthLabel(date: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(date);
}

function compactMonth(date: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, { month: "long" }).format(date);
}

function shortDate(key: string | null, locale: string) {
  if (!key) return "בחירת תאריך";
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(dateFromKey(key));
}

function longDate(key: string | null, locale: string) {
  if (!key) return "טרם נבחר";
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(dateFromKey(key));
}

function dateDiff(start: string, end: string) {
  return Math.round((dateFromKey(end).getTime() - dateFromKey(start).getTime()) / DAY_MS);
}

function minimumNights(date: Date) {
  return date.getDay() === 4 || date.getDay() === 5 ? 2 : 1;
}

function sourceMinimum(date: Date, calendar?: StayCalendar | null, illustrative = false) {
  return calendar ? stayCalendarDay(calendar, keyOf(date)).minimumNights ?? 1 : illustrative ? minimumNights(date) : 1;
}

function sourceAvailability(date: Date, mode: CalendarMode, businessKind: BusinessKind, calendar?: StayCalendar | null, illustrative = false): Availability {
  if (date < DEMO_TODAY) return { kind: "past", units: 0, label: "תאריך שעבר" };
  if (calendar) {
    const day = stayCalendarDay(calendar, keyOf(date));
    if (!day.known) return { kind: "open", units: 0, label: "הזמינות טרם נבדקה", unknown: true };
    return { kind: day.units ? "open" : "busy", units: day.units, label: day.units ? day.arrivalAllowed ? "פנוי" : "אין כניסה בתאריך זה" : "תפוס" };
  }
  return mode === "business" && !illustrative ? { kind: "open", units: 0, label: "לבחירה", unknown: true } : availabilityFor(date, mode, businessKind);
}

function availabilityFor(date: Date, mode: CalendarMode, businessKind: BusinessKind = "multi"): Availability {
  const key = keyOf(date);
  if (date < DEMO_TODAY) return { kind: "past", units: 0, label: "תאריך שעבר" };
  if (mode === "home") return { kind: "open", units: 0, label: "זמין לחיפוש" };
  if (BUSINESS_BUSY_DATES.has(key)) return { kind: "busy", units: 0, label: "תפוס" };
  if (businessKind === "single") return { kind: "open", units: 1, label: "פנוי" };
  if (BUSINESS_LIMITED_DATES.has(key)) return { kind: "limited", units: 1, label: "יחידה אחת פנויה" };
  if (BUSINESS_THREE_UNITS.has(key)) return { kind: "open", units: 3, label: "3 יחידות פנויות" };
  return { kind: "open", units: 4, label: "4 יחידות פנויות" };
}

function rangeHasBusyDate(start: string, end: string, businessKind: BusinessKind = "multi", resolver?: (date: Date) => Availability) {
  const cursor = addDays(dateFromKey(start), 1);
  const finish = dateFromKey(end);
  while (cursor < finish) {
    if ((resolver ? resolver(cursor) : availabilityFor(cursor, "business", businessKind)).kind === "busy") return true;
    cursor.setDate(cursor.getDate() + 1);
  }
  return false;
}

function findQuickRange(mode: CalendarMode, nights: number, preferredDay: number, businessKind: BusinessKind = "multi", resolver?: (date: Date) => Availability, calendar?: StayCalendar | null, illustrative = false) {
  let candidate = addDays(DEMO_TODAY, 1);
  for (let attempt = 0; attempt < 220; attempt += 1) {
    const stayLength = mode === "business" ? Math.max(nights, sourceMinimum(candidate, calendar, illustrative)) : nights;
    const end = addDays(candidate, stayLength);
    const startState = resolver ? resolver(candidate) : availabilityFor(candidate, mode, businessKind);
    if (
      candidate.getDay() === preferredDay &&
      startState.kind !== "busy" &&
      (calendar ? assessCalendarStay(calendar, keyOf(candidate), keyOf(end)).allowed : mode === "home" || !rangeHasBusyDate(keyOf(candidate), keyOf(end), businessKind, resolver))
    ) {
      return { start: keyOf(candidate), end: keyOf(end) };
    }
    candidate = addDays(candidate, 1);
  }
  return null;
}

function CalendarMonth({
  month,
  mode,
  checkIn,
  checkOut,
  onChoose,
  businessKind,
  secondary,
  locale,
  availabilityResolver,
  priceResolver,
  desktopVisible,
  liveCalendar,
  illustrative,
  calendarBlocked,
}: {
  month: Date;
  mode: CalendarMode;
  checkIn: string | null;
  checkOut: string | null;
  onChoose: (date: Date) => void;
  businessKind: BusinessKind;
  secondary?: boolean;
  locale: string;
  availabilityResolver?: (date: Date) => Availability;
  priceResolver?: (date: Date) => number | undefined;
  desktopVisible?: boolean;
  liveCalendar?: StayCalendar | null;
  illustrative?: boolean;
  calendarBlocked?: boolean;
}) {
  const weekdays = useMemo(() => Array.from({ length: 7 }, (_, index) => new Intl.DateTimeFormat(locale, { weekday: "narrow" }).format(new Date(2026, 7, 2 + index))), [locale]);

  const cells = useMemo(() => {
    const result: Array<Date | null> = [];
    const offset = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
    for (let index = 0; index < offset; index += 1) result.push(null);
    for (let day = 1; day <= daysInMonth(month); day += 1) {
      result.push(new Date(month.getFullYear(), month.getMonth(), day));
    }
    return result;
  }, [month]);

  return (
    <section className={`demo-month${secondary ? " secondary-month" : ""}${desktopVisible ? " desktop-visible" : ""}`} aria-label={monthLabel(month, locale)}>
      <h3>{monthLabel(month, locale)}</h3>
      <div className="demo-weekdays" aria-hidden="true">
        {weekdays.map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}
      </div>
      <div className="demo-days">
        {cells.map((date, index) => {
          if (!date) return <span className="demo-day-empty" key={`empty-${index}`} />;
          const key = keyOf(date);
          const state = availabilityResolver ? availabilityResolver(date) : sourceAvailability(date, mode, businessKind, liveCalendar, illustrative);
          const min = mode === "business" ? sourceMinimum(date, liveCalendar, illustrative) : 1;
          const choosingCheckout = Boolean(checkIn && !checkOut && key > checkIn);
          const sourceAllowsDate = !liveCalendar || (choosingCheckout
            ? assessCalendarStay(liveCalendar, checkIn!, key).allowed
            : stayCalendarDay(liveCalendar, key).arrivalAllowed);
          const canBeCheckout = Boolean(
            checkIn &&
            !checkOut &&
            key > checkIn &&
            state.kind === "busy" &&
            !rangeHasBusyDate(checkIn, key, businessKind, availabilityResolver),
          );
          const disabled = calendarBlocked || state.kind === "past" || !sourceAllowsDate || (state.kind === "busy" && !canBeCheckout);
          const isStart = key === checkIn;
          const isEnd = key === checkOut;
          const inRange = Boolean(checkIn && checkOut && key > checkIn && key < checkOut);

          const price = priceResolver?.(date);
          const liveDay = liveCalendar ? stayCalendarDay(liveCalendar, key) : null;
          return (
            <button
              type="button"
              key={key}
              className={[
                "demo-day",
                `state-${state.kind}`,
                isStart ? "range-start" : "",
                isEnd ? "range-end" : "",
                inRange ? "inside-range" : "",
              ].filter(Boolean).join(" ")}
              disabled={disabled}
              aria-pressed={isStart || isEnd}
              aria-label={`${date.getDate()} ${monthLabel(month, locale)}, ${canBeCheckout ? "אפשרי כתאריך עזיבה" : state.label}${mode === "business" && min > 1 ? `, מינימום ${min} לילות` : ""}${price ? `, החל מ-${price.toLocaleString("he-IL")} שקלים ל-${liveDay?.priceNights || min} לילות` : ""}`}
              onClick={() => onChoose(date)}
            >
              <span className="demo-day-number">{date.getDate()}</span>
              {price && state.kind !== "past" ? <span className="demo-day-price" dir="rtl">מ־{price.toLocaleString("he-IL")} ₪</span> : null}
              {mode === "business" && state.kind !== "past" && !state.unknown && (
                <span className="demo-availability">
                  {canBeCheckout ? "עזיבה" : state.kind === "busy" ? "תפוס" : businessKind === "single" ? "פנוי" : state.units === 1 ? "1 פנויה" : `${state.units} פנויות`}
                </span>
              )}
              {mode === "business" && min > 1 && !disabled && <span className="demo-minimum">מינ׳ {min}</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function CalendarDemo({
  mode,
  businessKind = "multi",
  businessName = "קסם הרימון",
  open,
  onClose,
  onCancel,
  onSkip,
  onConfirm,
  guests = 2,
  maxGuests = 20,
  onGuestsChange,
  availabilityResolver,
  priceResolver,
  liveCalendar,
  calendarRequired = false,
  calendarStatus = "idle",
  onRetryCalendar,
  illustrative = false,
}: {
  mode: CalendarMode;
  businessKind?: BusinessKind;
  businessName?: string;
  open: boolean;
  onClose: () => void;
  onCancel?: () => void;
  onSkip?: () => void;
  onConfirm: (result: CalendarResult) => void;
  guests?: number;
  maxGuests?: number;
  onGuestsChange?: (guests: number) => void;
  availabilityResolver?: (date: Date) => Availability;
  priceResolver?: (date: Date) => number | undefined;
  liveCalendar?: StayCalendar | null;
  calendarRequired?: boolean;
  calendarStatus?: "idle" | "loading" | "ready" | "error";
  onRetryCalendar?: () => void;
  illustrative?: boolean;
}) {
  const { language, translate } = useSiteLanguage();
  const dateLocale = { he: "he-IL", en: "en-GB", ru: "ru-RU", fr: "fr-FR" }[language];
  const cancel = onCancel ?? onClose;
  const [checkIn, setCheckIn] = useState<string | null>(null);
  const [checkOut, setCheckOut] = useState<string | null>(null);
  const [flexible, setFlexible] = useState(false);
  const [flexStay, setFlexStay] = useState<(typeof FLEX_STAYS)[number]["id"]>("weekend");
  const [flexMonth, setFlexMonth] = useState(0);
  const [flexDays, setFlexDays] = useState(3);
  const [visibleMonthIndex, setVisibleMonthIndex] = useState(0);
  const [notice, setNotice] = useState("בחרו תאריך הגעה");
  const calendarBodyRef = useRef<HTMLDivElement>(null);

  const visibleMonths = Array.from({ length: 12 }, (_, index) => addMonths(START_MONTH, index));
  const nights = checkIn && checkOut ? dateDiff(checkIn, checkOut) : 0;
  const selectedMin = mode === "business" && checkIn ? sourceMinimum(dateFromKey(checkIn), liveCalendar, illustrative) : 1;
  // A calendar outage must not dead-end booking. While loading we avoid a
  // premature choice; on error dates remain selectable as unknown and the
  // authoritative stay quote validates them immediately after confirmation.
  const calendarBlocked = calendarRequired && calendarStatus === "loading";
  const ready = !calendarBlocked && (flexible || Boolean(checkIn && checkOut && nights >= selectedMin && (!liveCalendar || assessCalendarStay(liveCalendar, checkIn, checkOut).allowed)));
  const effectiveResolver = availabilityResolver ?? ((date: Date) => sourceAvailability(date, mode, businessKind, liveCalendar, illustrative));

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") cancel();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [cancel, open]);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      if (calendarBodyRef.current) calendarBodyRef.current.scrollTop = 0;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  if (!open) return null;

  function chooseDate(date: Date) {
    const key = keyOf(date);
    if (calendarBlocked) return;
    if (liveCalendar && (!checkIn || checkOut || key <= checkIn) && !stayCalendarDay(liveCalendar, key).arrivalAllowed) return;
    if (!checkIn || checkOut) {
      setCheckIn(key);
      setCheckOut(null);
      const min = mode === "business" ? sourceMinimum(date, liveCalendar, illustrative) : 1;
      setNotice(min > 1 ? `בתאריך הזה נדרשים לפחות ${min} לילות` : "עכשיו בחרו תאריך עזיבה");
      return;
    }
    if (key <= checkIn) {
      setCheckIn(key);
      setCheckOut(null);
      setNotice("תאריך ההגעה עודכן, עכשיו בחרו עזיבה");
      return;
    }
    if (liveCalendar && !assessCalendarStay(liveCalendar, checkIn, key).allowed) return;
    if (mode === "business" && rangeHasBusyDate(checkIn, key, businessKind, effectiveResolver)) {
      setNotice("יש יום תפוס בתוך הטווח, בחרו טווח אחר");
      return;
    }
    setCheckOut(key);
    const selectedNights = dateDiff(checkIn, key);
    const min = mode === "business" ? sourceMinimum(dateFromKey(checkIn), liveCalendar, illustrative) : 1;
    setNotice(selectedNights < min ? `נדרשים לפחות ${min} לילות` : "הטווח מוכן להמשך");
  }

  function applyQuickStay(id: (typeof QUICK_STAYS)[number]["id"]) {
    const quick = QUICK_STAYS.find((item) => item.id === id);
    if (!quick) return;
    if (calendarBlocked) return;
    const range = findQuickRange(mode, quick.nights, quick.preferredDay, businessKind, effectiveResolver, liveCalendar, illustrative);
    if (!range) return;
    setCheckIn(range.start);
    setCheckOut(range.end);
    setFlexible(false);
    setNotice(mode === "business" ? "נמצא טווח פנוי שעומד בתנאי המקום" : "הטווח מוכן לחיפוש");
  }

  function reset() {
    setCheckIn(null);
    setCheckOut(null);
    setNotice("בחרו תאריך הגעה");
  }

  function continueWithoutDates() {
    reset();
    setFlexible(false);
    onSkip?.();
  }

  function confirm() {
    if (!ready) return;
    const selectedStay = FLEX_STAYS.find((stay) => stay.id === flexStay) ?? FLEX_STAYS[0];
    const selectedMonth = addMonths(START_MONTH, flexMonth);
    const summary = flexible
      ? `${translate(selectedStay.label)} · ${compactMonth(selectedMonth, dateLocale)} · ${flexDays === 0 ? translate("ללא גמישות") : `±${flexDays} ${translate(flexDays === 1 ? "יום" : "ימים")}`}`
      : `${shortDate(checkIn, dateLocale)} ${translate("עד")} ${shortDate(checkOut, dateLocale)}`;
    onConfirm({
      checkIn,
      checkOut,
      flexible,
      summary,
      flexibleStay: flexible ? selectedStay.id : null,
      flexibleMonth: flexible ? keyOf(selectedMonth).slice(0, 7) : null,
      flexibleDays: flexible ? flexDays : null,
    });
    onClose();
  }

  return createPortal(
    <div className="calendar-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && cancel()}>
      <section className={`calendar-dialog mode-${mode}`} role="dialog" aria-modal="true" aria-labelledby="calendar-dialog-title">
        <header className="calendar-dialog-header">
          <div>
            <span className="dialog-kicker">{translate(mode === "home" ? "חיפוש בכל האתר" : "זמינות במקום אחד")}</span>
            <h2 id="calendar-dialog-title">
              {translate(mode === "home" ? "מתי תרצו לצאת לחופשה?" : `בדיקת זמינות ב${businessName}`)}
            </h2>
            <p>
              {translate(mode === "home"
                ? "בחרו תאריכי הגעה ויציאה, או עברו לחיפוש עם גמישות בתאריכים."
                : businessKind === "single"
                  ? "בחרו תאריך הגעה ולאחריו תאריך עזיבה."
                  : "בחרו תאריכים לבדיקת היחידות שמתאימות לכם.")}
            </p>
          </div>
          <button type="button" className="dialog-close calendar-dialog-close" onClick={cancel} aria-label="סגירת חלון התאריכים">×</button>
        </header>

        {mode === "home" && <div className="search-dialog-worlds"><SearchWorldTabs active="vacation" onNavigate={cancel} /></div>}

        {mode === "home" && (
          <div className="date-mode-tabs" role="tablist" aria-label="אופן בחירת תאריכים">
            <button type="button" role="tab" aria-selected={!flexible} className={!flexible ? "active" : ""} onClick={() => setFlexible(false)}>{translate("תאריכים מדויקים")}</button>
            <button type="button" role="tab" aria-selected={flexible} className={flexible ? "active" : ""} onClick={() => setFlexible(true)}>{translate("גמישות בתאריכים")}</button>
          </div>
        )}

        {mode === "business" ? <div className="dialog-date-summary" aria-label="סיכום בחירת התאריכים">
          <div className={checkIn ? "selected" : ""}>
            <span>הגעה</span>
            <strong>{shortDate(checkIn, dateLocale)}</strong>
            <small>{checkIn ? effectiveResolver(dateFromKey(checkIn)).label : "בחרו את הלילה הראשון"}</small>
          </div>
          <span className="date-arrow" aria-hidden="true">←</span>
          <div className={checkOut ? "selected" : ""}>
            <span>עזיבה</span>
            <strong>{shortDate(checkOut, dateLocale)}</strong>
            <small>{checkOut ? nights === 1 ? "לילה אחד" : `${nights} לילות` : selectedMin === 1 ? "לפחות לילה אחד" : `לפחות ${selectedMin} לילות`}</small>
          </div>
          <span className="night-count">{checkIn && checkOut ? nights === 1 ? "לילה אחד" : `${nights} לילות` : selectedMin > 1 ? `מינימום ${selectedMin} לילות` : "בחירת טווח"}</span>
        </div> : null}

        {flexible ? (
          <div className="flexible-content">
            <p className="flexible-content__intro">{translate("לא חייבים לבחור ימים מדויקים. בחרו משך, חודש וטווח גמישות, ואנחנו נחפש את האפשרויות המתאימות.")}</p>
            <section className="flexible-section flexible-section--stay" aria-labelledby="flexible-stay-title">
              <div className="flexible-section__heading">
                <span>{translate("1. משך")}</span>
                <h3 id="flexible-stay-title">{translate("מה אורך השהייה?")}</h3>
              </div>
              <div className="choice-row flexible-stay-choices">
                {FLEX_STAYS.map((stay) => (
                  <button type="button" key={stay.id} className={flexStay === stay.id ? "selected" : ""} aria-pressed={flexStay === stay.id} onClick={() => setFlexStay(stay.id)}>
                    <strong>{translate(stay.label)}</strong>
                    <small>{translate(`${stay.nights} לילות`)}</small>
                  </button>
                ))}
              </div>
            </section>
            <section className="flexible-section flexible-section--month" aria-labelledby="flexible-month-title">
              <div className="flexible-section__heading">
                <span>{translate("2. חודש")}</span>
                <h3 id="flexible-month-title">{translate("מתי תרצו לנסוע?")}</h3>
              </div>
              <div className="choice-row month-choice-row">
                {Array.from({ length: 5 }, (_, index) => addMonths(START_MONTH, index)).map((month, index) => (
                  <button type="button" key={keyOf(month)} className={flexMonth === index ? "selected" : ""} aria-pressed={flexMonth === index} onClick={() => setFlexMonth(index)}>
                    <CalendarIcon />
                    <strong>{compactMonth(month, dateLocale)}</strong>
                    <small>{month.getFullYear()}</small>
                  </button>
                ))}
              </div>
            </section>
            <section className="flexible-section flexible-section--days" aria-labelledby="flexible-days-title">
              <div className="flexible-section__heading">
                <span>{translate("3. גמישות")}</span>
                <h3 id="flexible-days-title">{translate("כמה גמישות מתאימה לכם?")}</h3>
              </div>
              <div className="choice-row compact-choices">
                {[0, 1, 3, 7].map((days) => (
                  <button type="button" key={days} className={flexDays === days ? "selected" : ""} aria-pressed={flexDays === days} onClick={() => setFlexDays(days)}>
                    {days === 0 ? translate("ללא גמישות") : `±${days} ${translate(days === 1 ? "יום" : "ימים")}`}
                  </button>
                ))}
              </div>
            </section>
          </div>
        ) : (
          <div ref={calendarBodyRef} className="calendar-body">
            {calendarRequired && calendarStatus !== "ready" ? <div role="status" aria-live="polite">
              <p>{({ he: calendarStatus === "error" ? "אפשר לבחור תאריכים. הזמינות והמחיר ייבדקו מיד לאחר הבחירה." : "טוענים תאריכים פנויים ותנאי שהייה", en: calendarStatus === "error" ? "You can choose dates. Availability and price will be checked immediately afterwards." : "Loading available dates and stay requirements", ru: calendarStatus === "error" ? "Можно выбрать даты. Наличие и цена будут проверены сразу после выбора." : "Загружаем свободные даты и условия проживания", fr: calendarStatus === "error" ? "Vous pouvez choisir des dates. La disponibilité et le prix seront vérifiés juste après." : "Chargement des dates et des conditions de séjour" })[language]}</p>
              {calendarStatus === "error" && onRetryCalendar ? <button type="button" onClick={onRetryCalendar}>{({ he: "ניסיון נוסף", en: "Try again", ru: "Повторить", fr: "Réessayer" })[language]}</button> : null}
            </div> : null}
            <div className="calendar-toolbar">
              <div className="quick-date-buttons" aria-label="בחירת טווח מהירה">
                <span>{translate(mode === "home" ? "חיפוש מהיר" : "מציאת טווח פנוי")}</span>
                {QUICK_STAYS.map((stay) => <button type="button" key={stay.id} onClick={() => applyQuickStay(stay.id)}>{translate(stay.label)}</button>)}
              </div>
              <div className="month-nav calendar-month-nav" aria-label={translate("ניווט בין חודשים")}>
                <button type="button" onClick={() => setVisibleMonthIndex((index) => Math.max(0, index - 1))} disabled={visibleMonthIndex === 0} aria-label={translate("הצגת החודשים הקודמים")}>‹</button>
                <span>{monthLabel(visibleMonths[visibleMonthIndex], dateLocale)} · {monthLabel(visibleMonths[Math.min(visibleMonthIndex + 1, visibleMonths.length - 1)], dateLocale)}</span>
                <button type="button" onClick={() => setVisibleMonthIndex((index) => Math.min(visibleMonths.length - 2, index + 1))} disabled={visibleMonthIndex >= visibleMonths.length - 2} aria-label={translate("הצגת החודשים הבאים")}>›</button>
              </div>
            </div>

            <div className="dialog-months" aria-label="אופן בחירת תאריכים">
              {visibleMonths.map((month, index) => (
                <CalendarMonth key={keyOf(month)} month={month} mode={mode} businessKind={businessKind} checkIn={checkIn} checkOut={checkOut} onChoose={chooseDate} locale={dateLocale} availabilityResolver={availabilityResolver} priceResolver={priceResolver} liveCalendar={liveCalendar} illustrative={illustrative} calendarBlocked={calendarBlocked} desktopVisible={index === visibleMonthIndex || index === visibleMonthIndex + 1} />
              ))}
            </div>

            <div className="dialog-legend">
              {mode === "home" || !liveCalendar && !illustrative ? null : (
                <>
                  <span><i className="legend-dot open" /> פנוי</span>
                  {businessKind === "multi" && <span><i className="legend-dot limited" /> יחידה אחרונה</span>}
                  <span><i className="legend-dot busy" /> תפוס</span>
                  <span>מינימום לילות לפי תאריך ההגעה</span>
                </>
              )}
            </div>
          </div>
        )}

        {mode === "business" && ready && onGuestsChange ? <div className="calendar-dialog-guests" role="group" aria-label="כמות אורחים">
          <div><span>כמות אורחים</span><strong aria-live="polite">{guests} אורחים</strong></div>
          <div><button type="button" onClick={() => onGuestsChange(Math.max(1, guests - 1))} disabled={guests <= 1} aria-label="הפחתת אורח">−</button><button type="button" onClick={() => onGuestsChange(Math.min(maxGuests, guests + 1))} disabled={guests >= maxGuests} aria-label="הוספת אורח">+</button></div>
        </div> : null}

        <footer className="calendar-dialog-footer">
          <div className="dialog-status" aria-live="polite">
            <span className={ready ? "status-ready" : ""}>{ready ? "✓" : "i"}</span>
            <div>
              <strong>{flexible ? translate("החיפוש הגמיש מוכן") : checkIn && checkOut ? `${longDate(checkIn, dateLocale)} עד ${longDate(checkOut, dateLocale)}` : checkIn ? `${longDate(checkIn, dateLocale)} · ${notice}` : notice}</strong>
              <small>{!flexible && checkIn && checkOut ? `${nights === 1 ? "לילה אחד" : `${nights} לילות`} · ` : ""}{mode === "home" ? "הבחירה תחול על כל תוצאות האתר" : businessKind === "single" ? `הבחירה תחול על כל המקום ב${businessName}` : `הבחירה תחול רק על יחידות ${businessName}`}</small>
            </div>
          </div>
          <div className="dialog-actions">
            {mode === "home" && onSkip && <button type="button" className="mobile-date-skip calendar-without-dates" onClick={continueWithoutDates}>{translate("ללא תאריך")}</button>}
            {!flexible && <button type="button" className="clear-dates" onClick={reset} disabled={!checkIn && !checkOut}>ניקוי</button>}
            <button type="button" className="confirm-dates" onClick={confirm} disabled={!ready}>
              {mode === "home" ? "הבא" : businessKind === "single" ? "בדיקת מחיר וזמינות" : "בדיקת יחידות ומחירים"}
            </button>
          </div>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
