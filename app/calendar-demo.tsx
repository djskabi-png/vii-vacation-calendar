"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useSiteLanguage } from "./i18n/locale-provider";

export type CalendarMode = "home" | "business";
export type BusinessKind = "multi" | "single";

type Availability = {
  kind: "past" | "busy" | "limited" | "open";
  units: number;
  label: string;
};

type CalendarResult = {
  checkIn: string | null;
  checkOut: string | null;
  flexible: boolean;
  summary: string;
};

const DAY_MS = 86_400_000;
const DEMO_TODAY = new Date(2026, 7, 4);
const START_MONTH = new Date(2026, 7, 1);
const WEEKDAYS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

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

function rangeHasBusyDate(start: string, end: string, businessKind: BusinessKind = "multi") {
  const cursor = addDays(dateFromKey(start), 1);
  const finish = dateFromKey(end);
  while (cursor < finish) {
    if (availabilityFor(cursor, "business", businessKind).kind === "busy") return true;
    cursor.setDate(cursor.getDate() + 1);
  }
  return false;
}

function findQuickRange(mode: CalendarMode, nights: number, preferredDay: number, businessKind: BusinessKind = "multi") {
  let candidate = addDays(DEMO_TODAY, 1);
  for (let attempt = 0; attempt < 220; attempt += 1) {
    const stayLength = mode === "business" ? Math.max(nights, minimumNights(candidate)) : nights;
    const end = addDays(candidate, stayLength);
    const startState = availabilityFor(candidate, mode, businessKind);
    if (
      candidate.getDay() === preferredDay &&
      startState.kind !== "busy" &&
      (mode === "home" || !rangeHasBusyDate(keyOf(candidate), keyOf(end), businessKind))
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
}: {
  month: Date;
  mode: CalendarMode;
  checkIn: string | null;
  checkOut: string | null;
  onChoose: (date: Date) => void;
  businessKind: BusinessKind;
  secondary?: boolean;
  locale: string;
}) {
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
    <section className={`demo-month${secondary ? " secondary-month" : ""}`} aria-label={monthLabel(month, locale)}>
      <h3>{monthLabel(month, locale)}</h3>
      <div className="demo-weekdays" aria-hidden="true">
        {WEEKDAYS.map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className="demo-days">
        {cells.map((date, index) => {
          if (!date) return <span className="demo-day-empty" key={`empty-${index}`} />;
          const key = keyOf(date);
          const state = availabilityFor(date, mode, businessKind);
          const min = mode === "business" ? minimumNights(date) : 1;
          const disabled = state.kind === "past" || state.kind === "busy";
          const isStart = key === checkIn;
          const isEnd = key === checkOut;
          const inRange = Boolean(checkIn && checkOut && key > checkIn && key < checkOut);

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
              aria-label={`${date.getDate()} ${monthLabel(month, locale)}, ${state.label}${mode === "business" && min > 1 ? `, מינימום ${min} לילות` : ""}`}
              onClick={() => onChoose(date)}
            >
              <span className="demo-day-number">{date.getDate()}</span>
              {mode === "business" && state.kind !== "past" && (
                <span className="demo-availability">
                  {state.kind === "busy" ? "תפוס" : businessKind === "single" ? "פנוי" : state.units === 1 ? "1 פנויה" : `${state.units} פנויות`}
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
  onConfirm,
}: {
  mode: CalendarMode;
  businessKind?: BusinessKind;
  businessName?: string;
  open: boolean;
  onClose: () => void;
  onCancel?: () => void;
  onConfirm: (result: CalendarResult) => void;
}) {
  const { language } = useSiteLanguage();
  const dateLocale = { he: "he-IL", en: "en-GB", ru: "ru-RU", fr: "fr-FR" }[language];
  const cancel = onCancel ?? onClose;
  const [checkIn, setCheckIn] = useState<string | null>(null);
  const [checkOut, setCheckOut] = useState<string | null>(null);
  const [flexible, setFlexible] = useState(false);
  const [flexStay, setFlexStay] = useState<(typeof FLEX_STAYS)[number]["id"]>("weekend");
  const [flexMonth, setFlexMonth] = useState(0);
  const [flexDays, setFlexDays] = useState(3);
  const [notice, setNotice] = useState("בחרו תאריך הגעה");

  const visibleMonths = Array.from({ length: 12 }, (_, index) => addMonths(START_MONTH, index));
  const nights = checkIn && checkOut ? dateDiff(checkIn, checkOut) : 0;
  const selectedMin = mode === "business" && checkIn ? minimumNights(dateFromKey(checkIn)) : 1;
  const ready = flexible || Boolean(checkIn && checkOut && nights >= selectedMin);

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

  if (!open) return null;

  function chooseDate(date: Date) {
    const key = keyOf(date);
    if (!checkIn || checkOut) {
      setCheckIn(key);
      setCheckOut(null);
      const min = mode === "business" ? minimumNights(date) : 1;
      setNotice(min > 1 ? `בתאריך הזה נדרשים לפחות ${min} לילות` : "עכשיו בחרו תאריך עזיבה");
      return;
    }
    if (key <= checkIn) {
      setCheckIn(key);
      setCheckOut(null);
      setNotice("תאריך ההגעה עודכן, עכשיו בחרו עזיבה");
      return;
    }
    if (mode === "business" && rangeHasBusyDate(checkIn, key, businessKind)) {
      setNotice("יש יום תפוס בתוך הטווח, בחרו טווח אחר");
      return;
    }
    setCheckOut(key);
    const selectedNights = dateDiff(checkIn, key);
    const min = mode === "business" ? minimumNights(dateFromKey(checkIn)) : 1;
    setNotice(selectedNights < min ? `נדרשים לפחות ${min} לילות` : "הטווח מוכן להמשך");
  }

  function applyQuickStay(id: (typeof QUICK_STAYS)[number]["id"]) {
    const quick = QUICK_STAYS.find((item) => item.id === id);
    if (!quick) return;
    const range = findQuickRange(mode, quick.nights, quick.preferredDay, businessKind);
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

  function confirm() {
    const selectedStay = FLEX_STAYS.find((stay) => stay.id === flexStay) ?? FLEX_STAYS[0];
    const summary = flexible
      ? `${selectedStay.label} ב${compactMonth(addMonths(START_MONTH, flexMonth), dateLocale)}, גמישות ${flexDays} ימים`
      : `${shortDate(checkIn, dateLocale)} עד ${shortDate(checkOut, dateLocale)}`;
    onConfirm({ checkIn, checkOut, flexible, summary });
    onClose();
  }

  return createPortal(
    <div className="calendar-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && cancel()}>
      <section className={`calendar-dialog mode-${mode}`} role="dialog" aria-modal="true" aria-labelledby="calendar-dialog-title">
        <header className="calendar-dialog-header">
          <div>
            <span className="dialog-kicker">{mode === "home" ? "חיפוש בכל האתר" : "זמינות במקום אחד"}</span>
            <h2 id="calendar-dialog-title">
              {mode === "home" ? "מתי תרצו לצאת לחופשה?" : `בדיקת זמינות ב${businessName}`}
            </h2>
            <p>
              {mode === "home"
                ? "כל תאריך עתידי ניתן לחיפוש. הזמינות תיבדק מול כל המקומות בתוצאות."
                : businessKind === "single"
                  ? "ימים תפוסים ומינימום הלילות משפיעים על הטווח שניתן לבחור. במקום יחיד אין צורך להציג כמות יחידות."
                  : "ימים תפוסים, מספר היחידות ומינימום הלילות משפיעים על הטווח שניתן לבחור."}
            </p>
          </div>
          <button type="button" className="dialog-close calendar-dialog-close" onClick={cancel} aria-label="סגירת חלון התאריכים">×</button>
        </header>

        {mode === "home" && (
          <div className="date-mode-tabs" role="tablist" aria-label="אופן בחירת תאריכים">
            <button type="button" role="tab" aria-selected={!flexible} className={!flexible ? "active" : ""} onClick={() => setFlexible(false)}>תאריכים מדויקים</button>
            <button type="button" role="tab" aria-selected={flexible} className={flexible ? "active" : ""} onClick={() => setFlexible(true)}>אני גמיש</button>
          </div>
        )}

        {flexible ? (
          <div className="flexible-content">
            <div>
              <h3>כמה זמן?</h3>
              <div className="choice-row">
                {FLEX_STAYS.map((stay) => (
                  <button type="button" key={stay.id} className={flexStay === stay.id ? "selected" : ""} onClick={() => setFlexStay(stay.id)}>
                    <strong>{stay.label}</strong>
                    <small>{stay.nights} לילות</small>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h3>באיזה חודש?</h3>
              <div className="choice-row month-choice-row">
                {Array.from({ length: 5 }, (_, index) => addMonths(START_MONTH, index)).map((month, index) => (
                  <button type="button" key={keyOf(month)} className={flexMonth === index ? "selected" : ""} onClick={() => setFlexMonth(index)}>
                    <strong>{compactMonth(month, dateLocale)}</strong>
                    <small>{month.getFullYear()}</small>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h3>כמה גמישות?</h3>
              <div className="choice-row compact-choices">
                {[0, 1, 3, 7].map((days) => (
                  <button type="button" key={days} className={flexDays === days ? "selected" : ""} onClick={() => setFlexDays(days)}>
                    {days === 0 ? "ללא גמישות" : `${days} ימים לכל כיוון`}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="calendar-body">
            <div className="calendar-toolbar">
              <div className="quick-date-buttons" aria-label="בחירת טווח מהירה">
                <span>{mode === "home" ? "חיפוש מהיר" : "מציאת טווח פנוי"}</span>
                {QUICK_STAYS.map((stay) => <button type="button" key={stay.id} onClick={() => applyQuickStay(stay.id)}>{stay.label}</button>)}
              </div>
            </div>

            <div className="dialog-months" aria-label="אופן בחירת תאריכים">
              {visibleMonths.map((month) => (
                <CalendarMonth key={keyOf(month)} month={month} mode={mode} businessKind={businessKind} checkIn={checkIn} checkOut={checkOut} onChoose={chooseDate} locale={dateLocale} />
              ))}
            </div>

            <div className="dialog-legend">
              {mode === "home" ? (
                <span><i className="legend-dot general" /> כל תאריך עתידי ניתן לחיפוש</span>
              ) : (
                <>
                  <span><i className="legend-dot open" /> פנוי</span>
                  {businessKind === "multi" && <span><i className="legend-dot limited" /> יחידה אחרונה</span>}
                  <span><i className="legend-dot busy" /> תפוס</span>
                  <span><b>מינ׳ 2</b> מינימום לילות</span>
                </>
              )}
            </div>
          </div>
        )}

        <footer className="calendar-dialog-footer">
          <div className="dialog-status" aria-live="polite">
            <span className={ready ? "status-ready" : ""}>{ready ? "✓" : "i"}</span>
            <div>
              <strong>{flexible ? "החיפוש הגמיש מוכן" : checkIn && checkOut ? `${longDate(checkIn, dateLocale)} עד ${longDate(checkOut, dateLocale)}` : checkIn ? `${longDate(checkIn, dateLocale)} · ${notice}` : notice}</strong>
              <small>{!flexible && checkIn && checkOut ? `${nights === 1 ? "לילה אחד" : `${nights} לילות`} · ` : ""}{mode === "home" ? "הבחירה תחול על כל תוצאות האתר" : businessKind === "single" ? `הבחירה תחול על כל המקום ב${businessName}` : `הבחירה תחול רק על יחידות ${businessName}`}</small>
            </div>
          </div>
          <div className="dialog-actions">
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
