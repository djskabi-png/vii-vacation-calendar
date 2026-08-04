"use client";

import { useMemo, useState } from "react";

type Availability = {
  kind: "past" | "busy" | "limited" | "open";
  units: number;
  label: string;
};

const DAY_MS = 86_400_000;
const TODAY = new Date(2026, 7, 4);
const WEEKDAYS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
const BUSY_DATES = new Set([
  "2026-08-04",
  "2026-08-09",
  "2026-08-10",
  "2026-08-11",
  "2026-08-18",
  "2026-08-19",
  "2026-08-31",
  "2026-09-01",
  "2026-09-04",
  "2026-09-07",
]);
const LIMITED_DATES = new Set([
  "2026-08-05",
  "2026-08-06",
  "2026-08-12",
  "2026-08-13",
  "2026-08-25",
  "2026-08-26",
  "2026-09-08",
  "2026-09-09",
]);

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

function availabilityFor(date: Date): Availability {
  const key = keyOf(date);
  if (date < TODAY) return { kind: "past", units: 0, label: "עבר" };
  if (BUSY_DATES.has(key)) return { kind: "busy", units: 0, label: "תפוס" };
  if (LIMITED_DATES.has(key)) return { kind: "limited", units: 1, label: "יחידה אחת" };
  return { kind: "open", units: 2, label: "2 יחידות" };
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("he-IL", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function shortDate(key: string | null) {
  if (!key) return "בחירת תאריך";
  return new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "short",
  }).format(dateFromKey(key));
}

function longDate(key: string | null) {
  if (!key) return "טרם נבחר";
  return new Intl.DateTimeFormat("he-IL", {
    weekday: "short",
    day: "numeric",
    month: "long",
  }).format(dateFromKey(key));
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function daysInMonth(month: Date) {
  return new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
}

function dateDiff(start: string, end: string) {
  return Math.round((dateFromKey(end).getTime() - dateFromKey(start).getTime()) / DAY_MS);
}

function rangeHasBlockedDate(start: string, end: string) {
  const cursor = new Date(dateFromKey(start));
  const finish = dateFromKey(end);
  cursor.setDate(cursor.getDate() + 1);
  while (cursor < finish) {
    const state = availabilityFor(cursor);
    if (state.kind === "busy" || state.kind === "past") return true;
    cursor.setDate(cursor.getDate() + 1);
  }
  return false;
}

function CalendarMonth({
  month,
  checkIn,
  checkOut,
  onDateClick,
  secondary = false,
}: {
  month: Date;
  checkIn: string | null;
  checkOut: string | null;
  onDateClick: (date: Date) => void;
  secondary?: boolean;
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
    <section className={`month-card${secondary ? " secondary" : ""}`} aria-label={monthLabel(month)}>
      <h2>{monthLabel(month)}</h2>
      <div className="weekdays" aria-hidden="true">
        {WEEKDAYS.map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className="days-grid">
        {cells.map((date, index) => {
          if (!date) return <span className="empty-day" key={`empty-${index}`} />;
          const key = keyOf(date);
          const availability = availabilityFor(date);
          const isStart = key === checkIn;
          const isEnd = key === checkOut;
          const inRange = Boolean(checkIn && checkOut && key > checkIn && key < checkOut);
          const disabled = availability.kind === "past" || availability.kind === "busy";

          return (
            <button
              type="button"
              className={[
                "day",
                `is-${availability.kind}`,
                isStart ? "is-start" : "",
                isEnd ? "is-end" : "",
                inRange ? "is-range" : "",
              ].filter(Boolean).join(" ")}
              key={key}
              onClick={() => onDateClick(date)}
              disabled={disabled}
              aria-pressed={isStart || isEnd}
              aria-label={`${date.getDate()} ${monthLabel(month)}, ${availability.label}`}
            >
              <span className="day-number">{date.getDate()}</span>
              <span className="availability">
                <span className="availability-dot" />
                {availability.kind === "busy" ? "תפוס" : availability.kind === "past" ? "" : availability.units}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default function Home() {
  const [monthOffset, setMonthOffset] = useState(0);
  const [checkIn, setCheckIn] = useState<string | null>(null);
  const [checkOut, setCheckOut] = useState<string | null>(null);
  const [notice, setNotice] = useState("בחרו תאריך הגעה");
  const [confirmed, setConfirmed] = useState(false);
  const firstMonth = addMonths(new Date(2026, 7, 1), monthOffset);
  const secondMonth = addMonths(firstMonth, 1);
  const nights = checkIn && checkOut ? dateDiff(checkIn, checkOut) : 0;

  function chooseDate(date: Date) {
    const key = keyOf(date);
    setConfirmed(false);

    if (!checkIn || checkOut) {
      setCheckIn(key);
      setCheckOut(null);
      setNotice("עכשיו בחרו תאריך עזיבה");
      return;
    }

    if (key <= checkIn) {
      setCheckIn(key);
      setCheckOut(null);
      setNotice("תאריך ההגעה עודכן. עכשיו בחרו תאריך עזיבה");
      return;
    }

    if (rangeHasBlockedDate(checkIn, key)) {
      setNotice("בטווח שבחרתם יש תאריך תפוס. נסו טווח אחר");
      return;
    }

    setCheckOut(key);
    setNotice("הטווח מוכן לאישור");
  }

  function resetSelection() {
    setCheckIn(null);
    setCheckOut(null);
    setConfirmed(false);
    setNotice("בחרו תאריך הגעה");
  }

  return (
    <main className="page-shell" dir="rtl">
      <div className="soft-orb orb-one" />
      <div className="soft-orb orb-two" />

      <section className="picker" aria-labelledby="picker-title">
        <header className="picker-header">
          <div className="brand" aria-label="VII">
            <span className="brand-mark">V</span>
            <span>
              <strong>VII</strong>
              <small>החופשה שלכם מתחילה כאן</small>
            </span>
          </div>

          <div className="title-block">
            <span className="eyebrow">גרסת הדגמה · בחירת תאריכים</span>
            <h1 id="picker-title">מתי תרצו לצאת לחופשה?</h1>
            <p>בחרו תאריך הגעה ועזיבה וראו מיד את הזמינות.</p>
          </div>

          <div className="selection-summary" aria-live="polite">
            <div className={`summary-box${checkIn ? " selected" : ""}`}>
              <span>הגעה</span>
              <strong>{shortDate(checkIn)}</strong>
              <small>{longDate(checkIn)}</small>
            </div>
            <span className="summary-arrow" aria-hidden="true">←</span>
            <div className={`summary-box${checkOut ? " selected" : ""}`}>
              <span>עזיבה</span>
              <strong>{shortDate(checkOut)}</strong>
              <small>{longDate(checkOut)}</small>
            </div>
          </div>
        </header>

        <div className="calendar-toolbar">
          <button
            type="button"
            className="nav-button"
            onClick={() => setMonthOffset((value) => Math.max(0, value - 1))}
            disabled={monthOffset === 0}
            aria-label="החודש הקודם"
          >
            ‹
          </button>
          <div className="mobile-month-label">{monthLabel(firstMonth)}</div>
          <button
            type="button"
            className="nav-button"
            onClick={() => setMonthOffset((value) => Math.min(10, value + 1))}
            disabled={monthOffset === 10}
            aria-label="החודש הבא"
          >
            ›
          </button>
        </div>

        <div className="months-grid">
          <CalendarMonth
            month={firstMonth}
            checkIn={checkIn}
            checkOut={checkOut}
            onDateClick={chooseDate}
          />
          <CalendarMonth
            month={secondMonth}
            checkIn={checkIn}
            checkOut={checkOut}
            onDateClick={chooseDate}
            secondary
          />
        </div>

        <div className="legend" aria-label="מקרא זמינות">
          <span><i className="dot open" />2 יחידות פנויות</span>
          <span><i className="dot limited" />יחידה אחרונה</span>
          <span><i className="dot busy" />תפוס</span>
          <span className="demo-note">נתוני הזמינות להמחשה בלבד</span>
        </div>

        <footer className="picker-footer">
          <div className="footer-status" aria-live="polite">
            <span className={`status-icon${confirmed ? " confirmed" : ""}`}>
              {confirmed ? "✓" : "i"}
            </span>
            <div>
              <strong>{confirmed ? "התאריכים נשמרו" : notice}</strong>
              <small>
                {checkIn && checkOut
                  ? `${longDate(checkIn)} עד ${longDate(checkOut)}, ${nights} לילות`
                  : "אפשר לבחור רק תאריכים זמינים"}
              </small>
            </div>
          </div>

          <div className="footer-actions">
            <button type="button" className="reset-button" onClick={resetSelection} disabled={!checkIn && !checkOut}>
              איפוס
            </button>
            <button
              type="button"
              className="confirm-button"
              disabled={!checkIn || !checkOut}
              onClick={() => setConfirmed(true)}
            >
              אישור התאריכים
              <span aria-hidden="true">←</span>
            </button>
          </div>
        </footer>
      </section>
    </main>
  );
}
