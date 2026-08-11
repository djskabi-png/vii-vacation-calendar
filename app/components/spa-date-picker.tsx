"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { SearchWorldTabs } from "./world-switcher";

export type SpaDateResult = {
  date: string | null;
  withoutDate: boolean;
  summary: string;
};

const WEEKDAYS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

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

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("he-IL", { month: "long", year: "numeric" }).format(date);
}

function dateLabel(key: string) {
  return new Intl.DateTimeFormat("he-IL", { weekday: "short", day: "numeric", month: "long" }).format(dateFromKey(key));
}

function daysInMonth(month: Date) {
  return new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
}

export function SpaDatePicker({
  open,
  onClose,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onCancel?: () => void;
  onConfirm: (result: SpaDateResult) => void;
}) {
  const cancel = onCancel ?? onClose;
  const today = useMemo(() => startOfDay(new Date()), []);
  const firstMonth = useMemo(() => startOfMonth(today), [today]);
  const [withoutDate, setWithoutDate] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [monthOffset, setMonthOffset] = useState(0);
  const displayedMonth = addMonths(firstMonth, monthOffset);
  const cells = useMemo(() => {
    const result: Array<Date | null> = [];
    const offset = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth(), 1).getDay();
    for (let index = 0; index < offset; index += 1) result.push(null);
    for (let day = 1; day <= daysInMonth(displayedMonth); day += 1) {
      result.push(new Date(displayedMonth.getFullYear(), displayedMonth.getMonth(), day));
    }
    return result;
  }, [displayedMonth]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function closeWithEscape(event: KeyboardEvent) {
      if (event.key === "Escape") cancel();
    }
    window.addEventListener("keydown", closeWithEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeWithEscape);
    };
  }, [cancel, open]);

  if (!open) return null;

  const ready = withoutDate || Boolean(selectedDate);

  function confirm() {
    if (!ready) return;
    onConfirm(withoutDate
      ? { date: null, withoutDate: true, summary: "בלי תאריך כרגע" }
      : { date: selectedDate, withoutDate: false, summary: selectedDate ? dateLabel(selectedDate) : "בחרו תאריך" });
    onClose();
  }

  return createPortal(
    <div className="calendar-overlay spa-date-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && cancel()}>
      <section className="spa-date-dialog" role="dialog" aria-modal="true" aria-labelledby="spa-date-title">
        <header className="spa-date-dialog__header">
          <div>
            <span>תיאום הספא</span>
            <h2 id="spa-date-title">מתי תרצו להגיע?</h2>
            <p>בוחרים יום אחד, או ממשיכים בלי תאריך ומחליטים בהמשך.</p>
          </div>
          <button type="button" className="dialog-close" aria-label="סגירת בחירת תאריך לספא" onClick={cancel}>×</button>
        </header>

        <div className="search-dialog-worlds"><SearchWorldTabs active="spa" onNavigate={cancel} /></div>

        <div className="spa-date-choice" role="tablist" aria-label="בחירת מועד לספא">
          <button type="button" role="tab" aria-selected={!withoutDate} className={!withoutDate ? "active" : ""} onClick={() => setWithoutDate(false)}>בחירת תאריך</button>
          <button type="button" role="tab" aria-selected={withoutDate} className={withoutDate ? "active" : ""} onClick={() => setWithoutDate(true)}>בלי תאריך כרגע</button>
        </div>

        {!withoutDate ? <div className="spa-date-dialog__body">
          <div className="spa-calendar-toolbar">
            <button type="button" aria-label="החודש הקודם" disabled={monthOffset === 0} onClick={() => setMonthOffset((value) => Math.max(0, value - 1))}>→</button>
            <strong>{monthLabel(displayedMonth)}</strong>
            <button type="button" aria-label="החודש הבא" onClick={() => setMonthOffset((value) => value + 1)}>←</button>
          </div>
          <section className="spa-calendar" aria-label={monthLabel(displayedMonth)}>
            <div className="spa-calendar__weekdays" aria-hidden="true">{WEEKDAYS.map((day) => <span key={day}>{day}</span>)}</div>
            <div className="spa-calendar__days">{cells.map((date, index) => {
              if (!date) return <span className="spa-calendar__empty" key={`empty-${index}`} />;
              const key = keyOf(date);
              const disabled = date < today;
              return <button type="button" key={key} disabled={disabled} aria-pressed={selectedDate === key} aria-label={dateLabel(key)} className={selectedDate === key ? "selected" : ""} onClick={() => setSelectedDate(key)}>{date.getDate()}</button>;
            })}</div>
          </section>
        </div> : <div className="spa-no-date">
          <span aria-hidden="true">○</span>
          <h3>אפשר להחליט אחר כך</h3>
          <p>נציג את מתחמי הספא המתאימים, ותוכלו לבדוק תאריך וזמינות בהמשך.</p>
        </div>}

        <footer className="spa-date-dialog__footer">
          <div><span>{withoutDate ? "חיפוש פתוח" : "התאריך שנבחר"}</span><strong>{withoutDate ? "בלי תאריך כרגע" : selectedDate ? dateLabel(selectedDate) : "בחרו יום אחד"}</strong></div>
          <button type="button" className="spa-date-confirm" disabled={!ready} onClick={confirm}>המשך לחיפוש</button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
