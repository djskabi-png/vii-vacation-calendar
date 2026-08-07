"use client";

import { useMemo, useState } from "react";

type Props = {
  initialDate?: string;
  onSelectionChange?: (ready: boolean) => void;
};

const WEEKDAYS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
const MORNING_SLOTS = ["09:00", "09:45", "10:30", "11:15"];
const NOON_SLOTS = ["12:00", "12:45", "13:30", "14:15"];
const EVENING_SLOTS = ["15:30", "16:15", "17:00", "18:00"];

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseLocalDate(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toInputDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function sameDay(first: Date | null, second: Date) {
  return Boolean(first && first.getFullYear() === second.getFullYear() && first.getMonth() === second.getMonth() && first.getDate() === second.getDate());
}

function formatSelectedDate(date: Date | null) {
  if (!date) return "עדיין לא נבחר תאריך";
  return new Intl.DateTimeFormat("he-IL", { weekday: "long", day: "numeric", month: "long" }).format(date);
}

export function SpaAppointmentPicker({ initialDate, onSelectionChange }: Props) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const initial = useMemo(() => {
    const parsed = parseLocalDate(initialDate);
    return parsed && parsed >= today ? parsed : null;
  }, [initialDate, today]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(initial);
  const [selectedTime, setSelectedTime] = useState("");
  const [month, setMonth] = useState(() => new Date((initial || today).getFullYear(), (initial || today).getMonth(), 1));

  const calendarDays = useMemo(() => {
    const firstWeekday = month.getDay();
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return Array.from({ length: 42 }, (_, index) => {
      const dayNumber = index - firstWeekday + 1;
      return dayNumber > 0 && dayNumber <= daysInMonth ? new Date(month.getFullYear(), month.getMonth(), dayNumber) : null;
    });
  }, [month]);

  const timeGroups = useMemo(() => {
    if (!selectedDate) return [];
    const weekday = selectedDate.getDay();
    if (weekday === 6) return [{ label: "בוקר", slots: ["10:00", "10:45", "11:30", "12:15"] }, { label: "צהריים", slots: ["13:00", "13:45", "14:30"] }];
    if (weekday === 5) return [{ label: "בוקר", slots: MORNING_SLOTS }, { label: "צהריים", slots: NOON_SLOTS.slice(0, 3) }];
    return [{ label: "בוקר", slots: MORNING_SLOTS }, { label: "צהריים", slots: NOON_SLOTS }, { label: "אחר הצהריים", slots: EVENING_SLOTS }];
  }, [selectedDate]);

  function chooseDate(date: Date) {
    setSelectedDate(date);
    setSelectedTime("");
    onSelectionChange?.(false);
  }

  function chooseTime(time: string) {
    setSelectedTime(time);
    onSelectionChange?.(Boolean(selectedDate));
  }

  function moveMonth(direction: number) {
    const next = new Date(month.getFullYear(), month.getMonth() + direction, 1);
    const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    if (next < currentMonth) return;
    setMonth(next);
  }

  return <section className="spa-appointment form-wide" aria-labelledby="spa-appointment-title">
    <input name="date" type="hidden" value={selectedDate ? toInputDate(selectedDate) : ""} />
    <input name="time" type="hidden" value={selectedTime} />

    <header className="spa-appointment__header">
      <div>
        <span>בחירת מועד</span>
        <h2 id="spa-appointment-title">מתי תרצו להגיע?</h2>
        <p>בוחרים יום, ואז שעה פנויה. בדיוק כמו בהזמנה בספא.</p>
      </div>
      <ol aria-label="שלבי בחירת המועד">
        <li className={selectedDate ? "complete" : "active"}><b>1</b><span>תאריך</span></li>
        <li className={selectedTime ? "complete" : selectedDate ? "active" : ""}><b>2</b><span>שעה</span></li>
      </ol>
    </header>

    <div className="spa-appointment__body">
      <div className="spa-appointment__calendar">
        <div className="spa-appointment__month">
          <button type="button" onClick={() => moveMonth(-1)} disabled={month <= new Date(today.getFullYear(), today.getMonth(), 1)} aria-label="החודש הקודם">‹</button>
          <strong>{new Intl.DateTimeFormat("he-IL", { month: "long", year: "numeric" }).format(month)}</strong>
          <button type="button" onClick={() => moveMonth(1)} aria-label="החודש הבא">›</button>
        </div>
        <div className="spa-appointment__weekdays" aria-hidden="true">{WEEKDAYS.map((day) => <span key={day}>{day}</span>)}</div>
        <div className="spa-appointment__days" role="grid" aria-label="בחירת תאריך">
          {calendarDays.map((date, index) => date ? <button
            key={toInputDate(date)}
            type="button"
            role="gridcell"
            disabled={date < today}
            aria-label={new Intl.DateTimeFormat("he-IL", { weekday: "long", day: "numeric", month: "long" }).format(date)}
            aria-selected={sameDay(selectedDate, date)}
            className={`${sameDay(selectedDate, date) ? "selected" : ""} ${sameDay(today, date) ? "today" : ""}`.trim()}
            onClick={() => chooseDate(date)}
          >{date.getDate()}</button> : <span key={`empty-${index}`} aria-hidden="true" />)}
        </div>
      </div>

      <div className={`spa-appointment__times ${selectedDate ? "ready" : ""}`} aria-live="polite">
        <div className="spa-appointment__selected">
          <span>המועד שבחרתם</span>
          <strong>{formatSelectedDate(selectedDate)}</strong>
          {selectedTime ? <b dir="ltr">{selectedTime}</b> : null}
        </div>
        {!selectedDate ? <div className="spa-appointment__empty">
          <span aria-hidden="true">◷</span>
          <strong>השעות יופיעו כאן</strong>
          <p>בחרו תחילה יום פנוי בלוח.</p>
        </div> : <div className="spa-appointment__slots">
          <h3>בחרו שעת טיפול</h3>
          {timeGroups.map((group) => <div className="spa-appointment__slot-group" key={group.label}>
            <span>{group.label}</span>
            <div>{group.slots.map((time) => <button key={time} type="button" dir="ltr" aria-pressed={selectedTime === time} onClick={() => chooseTime(time)}>{time}</button>)}</div>
          </div>)}
        </div>}
      </div>
    </div>

    <footer className="spa-appointment__note">
      <span aria-hidden="true">i</span>
      <p><strong>השעות כפופות לאישור סופי.</strong> לאחר הבחירה נאמת את זמינות המקום לפני אישור ההזמנה.</p>
    </footer>
  </section>;
}
