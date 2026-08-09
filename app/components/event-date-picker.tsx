"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type EventDateMode = "exact" | "around" | "period";

export type EventDateResult = {
  mode: EventDateMode;
  from: string | null;
  to: string | null;
  summary: string;
};

const WEEKDAYS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
const FLEXIBILITY_OPTIONS = [
  { value: 1, label: "יום לכל כיוון" },
  { value: 3, label: "עד 3 ימים" },
  { value: 7, label: "עד שבוע" },
];

const PERIOD_OPTIONS = [
  { id: "two-weeks", label: "בשבועיים הקרובים", days: 14 },
  { id: "month", label: "בחודש הקרוב", days: 30 },
  { id: "two-months", label: "בחודשיים הקרובים", days: 60 },
] as const;

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addDays(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);
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

function monthOnlyLabel(date: Date) {
  return new Intl.DateTimeFormat("he-IL", { month: "long", year: "numeric" }).format(date);
}

function daysInMonth(month: Date) {
  return new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
}

export function EventDatePicker({
  open,
  onClose,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onCancel?: () => void;
  onConfirm: (result: EventDateResult) => void;
}) {
  const cancel = onCancel ?? onClose;
  const today = useMemo(() => startOfDay(new Date()), []);
  const firstMonth = useMemo(() => startOfMonth(today), [today]);
  const [mode, setMode] = useState<EventDateMode>("exact");
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [flexibility, setFlexibility] = useState(3);
  const [period, setPeriod] = useState<(typeof PERIOD_OPTIONS)[number]["id"]>("month");
  const [specificMonthOffset, setSpecificMonthOffset] = useState<number | null>(null);

  const displayedMonth = addMonths(firstMonth, monthOffset);
  const futureMonths = [0, 1, 2, 3].map((offset) => ({ offset, date: addMonths(firstMonth, offset) }));
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

  const ready = mode === "period" || Boolean(selectedDate);

  function switchMode(nextMode: EventDateMode) {
    setMode(nextMode);
  }

  function confirm() {
    if (!ready) return;

    if (mode === "exact" && selectedDate) {
      onConfirm({ mode, from: selectedDate, to: selectedDate, summary: dateLabel(selectedDate) });
    }

    if (mode === "around" && selectedDate) {
      const selected = dateFromKey(selectedDate);
      onConfirm({
        mode,
        from: keyOf(addDays(selected, -flexibility)),
        to: keyOf(addDays(selected, flexibility)),
        summary: `סביב ${dateLabel(selectedDate)}, גמישות של ${flexibility === 1 ? "יום" : `${flexibility} ימים`}`,
      });
    }

    if (mode === "period") {
      if (specificMonthOffset !== null) {
        const month = addMonths(firstMonth, specificMonthOffset);
        const from = month < today ? today : month;
        const to = new Date(month.getFullYear(), month.getMonth() + 1, 0);
        onConfirm({ mode, from: keyOf(from), to: keyOf(to), summary: `במהלך ${monthOnlyLabel(month)}` });
      } else {
        const selectedPeriod = PERIOD_OPTIONS.find((option) => option.id === period) ?? PERIOD_OPTIONS[1];
        onConfirm({
          mode,
          from: keyOf(today),
          to: keyOf(addDays(today, selectedPeriod.days)),
          summary: selectedPeriod.label,
        });
      }
    }

    onClose();
  }

  return createPortal(
    <div className="calendar-overlay event-date-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && cancel()}>
      <section className="event-date-dialog" role="dialog" aria-modal="true" aria-labelledby="event-date-title">
        <header className="event-date-dialog__header">
          <div>
            <span>תכנון האירוע</span>
            <h2 id="event-date-title">מתי תרצו לקיים את האירוע?</h2>
            <p>אפשר לבחור יום מסוים, לחפש סביב תאריך מועדף או להגדיר תקופה.</p>
          </div>
          <button type="button" className="dialog-close" aria-label="סגירת בחירת תאריך לאירוע" onClick={cancel}>×</button>
        </header>

        <div className="event-date-modes" role="tablist" aria-label="אופן בחירת מועד לאירוע">
          <button type="button" role="tab" aria-selected={mode === "exact"} className={mode === "exact" ? "active" : ""} onClick={() => switchMode("exact")}>תאריך מדויק</button>
          <button type="button" role="tab" aria-selected={mode === "around"} className={mode === "around" ? "active" : ""} onClick={() => switchMode("around")}>גמיש סביב תאריך</button>
          <button type="button" role="tab" aria-selected={mode === "period"} className={mode === "period" ? "active" : ""} onClick={() => switchMode("period")}>במהלך תקופה</button>
        </div>

        {mode !== "period" ? (
          <div className="event-date-dialog__body">
            <div className="event-date-selection">
              <span>{mode === "exact" ? "התאריך שבחרתם" : "התאריך המועדף"}</span>
              <strong>{selectedDate ? dateLabel(selectedDate) : "עדיין לא נבחר תאריך"}</strong>
              {mode === "around" && <small>נבדוק מקומות פנויים גם בימים הסמוכים.</small>}
            </div>

            <div className="event-calendar-toolbar">
              <button type="button" aria-label="החודש הקודם" disabled={monthOffset === 0} onClick={() => setMonthOffset((value) => Math.max(0, value - 1))}>→</button>
              <strong>{monthLabel(displayedMonth)}</strong>
              <button type="button" aria-label="החודש הבא" onClick={() => setMonthOffset((value) => value + 1)}>←</button>
            </div>

            <section className="event-calendar" aria-label={monthLabel(displayedMonth)}>
              <div className="event-calendar__weekdays" aria-hidden="true">{WEEKDAYS.map((day) => <span key={day}>{day}</span>)}</div>
              <div className="event-calendar__days">
                {cells.map((date, index) => {
                  if (!date) return <span className="event-calendar__empty" key={`empty-${index}`} />;
                  const key = keyOf(date);
                  const disabled = date < today;
                  return <button type="button" key={key} disabled={disabled} aria-pressed={selectedDate === key} aria-label={dateLabel(key)} className={selectedDate === key ? "selected" : ""} onClick={() => setSelectedDate(key)}>{date.getDate()}</button>;
                })}
              </div>
            </section>

            {mode === "around" && <fieldset className="event-flexibility">
              <legend>עד כמה אתם גמישים בתאריך?</legend>
              <div>{FLEXIBILITY_OPTIONS.map((option) => <button type="button" key={option.value} className={flexibility === option.value ? "selected" : ""} aria-pressed={flexibility === option.value} onClick={() => setFlexibility(option.value)}>{option.label}</button>)}</div>
            </fieldset>}
          </div>
        ) : (
          <div className="event-period-picker">
            <section>
              <h3>מתי נוח לכם לחגוג?</h3>
              <p>נחפש מקומות שיכולים להתאים בתוך חלון הזמן שבחרתם.</p>
              <div className="event-period-options">{PERIOD_OPTIONS.map((option) => <button type="button" key={option.id} aria-pressed={specificMonthOffset === null && period === option.id} className={specificMonthOffset === null && period === option.id ? "selected" : ""} onClick={() => { setPeriod(option.id); setSpecificMonthOffset(null); }}>{option.label}</button>)}</div>
            </section>
            <section>
              <h3>או בחודש מסוים</h3>
              <div className="event-month-options">{futureMonths.map(({ offset, date }) => <button type="button" key={offset} aria-pressed={specificMonthOffset === offset} className={specificMonthOffset === offset ? "selected" : ""} onClick={() => setSpecificMonthOffset(offset)}>{monthOnlyLabel(date)}</button>)}</div>
            </section>
          </div>
        )}

        <footer className="event-date-dialog__footer">
          <div>
            <span>{mode === "exact" ? "תאריך אחד" : mode === "around" ? "חיפוש גמיש" : "חלון זמן"}</span>
            <strong>{mode === "period" ? (specificMonthOffset !== null ? `במהלך ${monthOnlyLabel(addMonths(firstMonth, specificMonthOffset))}` : (PERIOD_OPTIONS.find((option) => option.id === period)?.label ?? "בחודש הקרוב")) : selectedDate ? dateLabel(selectedDate) : "בחרו תאריך כדי להמשיך"}</strong>
          </div>
          <button type="button" className="event-date-confirm" disabled={!ready} onClick={confirm}>הצגת מקומות לאירוע</button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
