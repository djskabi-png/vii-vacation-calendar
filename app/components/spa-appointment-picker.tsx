"use client";

import { useMemo, useState } from "react";

type Props = {
  initialDate?: string;
  initialGuests?: string;
  offerName?: string;
  offerDuration?: string;
  onSelectionChange?: (selection: SpaAppointmentSelection) => void;
};

export type SpaAppointmentSelection = {
  ready: boolean;
  date: string;
  time: string;
  guests: number;
  composition: string;
  compositionLabel: string;
};

const WEEKDAYS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
const MORNING_SLOTS = ["09:00", "09:45", "10:30", "11:15"];
const NOON_SLOTS = ["12:00", "12:45", "13:30", "14:15"];
const EVENING_SLOTS = ["15:30", "16:15", "17:00", "18:00"];
const PARTICIPANT_OPTIONS = [1, 2, 3, 4];
const COMPOSITION_OPTIONS = [
  { id: "mixed", label: "גבר ואישה" },
  { id: "men", label: "שני גברים" },
  { id: "women", label: "שתי נשים" },
] as const;

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

export function SpaAppointmentPicker({ initialDate, initialGuests, offerName, offerDuration, onSelectionChange }: Props) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const initial = useMemo(() => {
    const parsed = parseLocalDate(initialDate);
    return parsed && parsed >= today ? parsed : null;
  }, [initialDate, today]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(initial);
  const [selectedTime, setSelectedTime] = useState("");
  const [participants, setParticipants] = useState(() => {
    const parsed = Number(initialGuests || 2);
    return Number.isFinite(parsed) ? Math.min(4, Math.max(1, Math.round(parsed))) : 2;
  });
  const [composition, setComposition] = useState("mixed");
  const [month, setMonth] = useState(() => new Date((initial || today).getFullYear(), (initial || today).getMonth(), 1));
  const participantsReady = participants !== 2 || Boolean(composition);
  const compositionLabel = COMPOSITION_OPTIONS.find((option) => option.id === composition)?.label || "";

  function notify(next: { date?: Date | null; time?: string; guests?: number; composition?: string }) {
    const date = next.date === undefined ? selectedDate : next.date;
    const time = next.time === undefined ? selectedTime : next.time;
    const guests = next.guests === undefined ? participants : next.guests;
    const nextComposition = next.composition === undefined ? composition : next.composition;
    const compositionLabel = COMPOSITION_OPTIONS.find((option) => option.id === nextComposition)?.label || "";
    onSelectionChange?.({
      ready: Boolean(date && time && (guests !== 2 || nextComposition)),
      date: date ? toInputDate(date) : "",
      time,
      guests,
      composition: nextComposition,
      compositionLabel,
    });
  }

  const calendarDays = useMemo(() => {
    const firstWeekday = month.getDay();
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return Array.from({ length: 42 }, (_, index) => {
      const dayNumber = index - firstWeekday + 1;
      return dayNumber > 0 && dayNumber <= daysInMonth ? new Date(month.getFullYear(), month.getMonth(), dayNumber) : null;
    });
  }, [month]);

  const timeGroups = useMemo(() => {
    if (!selectedDate || !participantsReady) return [];
    const weekday = selectedDate.getDay();
    if (weekday === 6) return [{ label: "בוקר", slots: ["10:00", "10:45", "11:30", "12:15"] }, { label: "צהריים", slots: ["13:00", "13:45", "14:30"] }];
    if (weekday === 5) return [{ label: "בוקר", slots: MORNING_SLOTS }, { label: "צהריים", slots: NOON_SLOTS.slice(0, 3) }];
    return [{ label: "בוקר", slots: MORNING_SLOTS }, { label: "צהריים", slots: NOON_SLOTS }, { label: "אחר הצהריים", slots: EVENING_SLOTS }];
  }, [participantsReady, selectedDate]);

  function chooseParticipants(value: number) {
    const nextComposition = value === 2 ? composition : "";
    setParticipants(value);
    setComposition(nextComposition);
    setSelectedTime("");
    notify({ guests: value, composition: nextComposition, time: "" });
  }

  function chooseComposition(value: string) {
    setComposition(value);
    setSelectedTime("");
    notify({ composition: value, time: "" });
  }

  function chooseDate(date: Date) {
    if (!participantsReady) return;
    setSelectedDate(date);
    setSelectedTime("");
    notify({ date, time: "" });
  }

  function chooseTime(time: string) {
    setSelectedTime(time);
    notify({ time });
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
    <input name="guests" type="hidden" value={participants} />
    <input name="spaCompositionLabel" type="hidden" value={compositionLabel} />
    {participants !== 2 ? <input name="spaComposition" type="hidden" value="not-applicable" /> : null}

    <header className="spa-appointment__header">
      <div>
        <span>הרכב ומועד</span>
        <h2 id="spa-appointment-title">מי מגיע ומתי?</h2>
        <p>בדיוק כמו בספא פלוס: בוחרים הרכב, תאריך ושעה מועדפת, ואז ממשיכים לפרטי המזמין.</p>
      </div>
      <ol aria-label="שלבי בחירת המועד">
        <li className={participantsReady ? "complete" : "active"}><b>1</b><span>הרכב</span></li>
        <li className={selectedDate && participantsReady ? "complete" : participantsReady ? "active" : ""}><b>2</b><span>תאריך</span></li>
        <li className={selectedTime ? "complete" : selectedDate && participantsReady ? "active" : ""}><b>3</b><span>שעה</span></li>
      </ol>
    </header>

    {offerName ? <div className="spa-appointment__offer" aria-label="החבילה שנבחרה">
      <span>החבילה שבחרתם</span>
      <strong>{offerName}</strong>
      {offerDuration ? <small>משך הטיפול: {offerDuration}</small> : null}
    </div> : null}

    <div className="spa-appointment__participants">
      <div className="spa-appointment__participant-heading"><span>שלב ראשון</span><strong>כמה אנשים מגיעים?</strong><small>ברירת המחדל היא שני אנשים</small></div>
      <div className="spa-appointment__participant-count" role="group" aria-label="מספר משתתפים">
        {PARTICIPANT_OPTIONS.map((value) => <button key={value} type="button" aria-pressed={participants === value} onClick={() => chooseParticipants(value)}><b>{value}</b><span>{value === 1 ? "אדם אחד" : `${value} אנשים`}</span></button>)}
      </div>
      {participants === 2 ? <fieldset className="spa-appointment__composition"><legend>מה הרכב המטופלים?</legend><p>המידע עוזר למקום להתאים את צוות המטפלים.</p><div>{COMPOSITION_OPTIONS.map((option) => <label key={option.id}><input type="radio" name="spaComposition" value={option.id} checked={composition === option.id} onChange={() => chooseComposition(option.id)} required /><span>{option.label}</span></label>)}</div></fieldset> : null}
    </div>

    <div className={`spa-appointment__body ${participantsReady ? "ready" : "locked"}`}>
      <div className="spa-appointment__calendar" aria-disabled={!participantsReady}>
        <div className="spa-appointment__month">
          <button type="button" onClick={() => moveMonth(-1)} disabled={!participantsReady || month <= new Date(today.getFullYear(), today.getMonth(), 1)} aria-label="החודש הקודם">‹</button>
          <strong>{new Intl.DateTimeFormat("he-IL", { month: "long", year: "numeric" }).format(month)}</strong>
          <button type="button" onClick={() => moveMonth(1)} disabled={!participantsReady} aria-label="החודש הבא">›</button>
        </div>
        <div className="spa-appointment__weekdays" aria-hidden="true">{WEEKDAYS.map((day) => <span key={day}>{day}</span>)}</div>
        <div className="spa-appointment__days" role="grid" aria-label="בחירת תאריך">
          {calendarDays.map((date, index) => date ? <button
            key={toInputDate(date)}
            type="button"
            role="gridcell"
            disabled={!participantsReady || date < today}
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
        {!participantsReady ? <div className="spa-appointment__empty">
          <span aria-hidden="true">2</span>
          <strong>בחרו קודם את הרכב המטופלים</strong>
          <p>לאחר הבחירה תוכלו לבחור תאריך ושעה.</p>
        </div> : !selectedDate ? <div className="spa-appointment__empty">
          <span aria-hidden="true">◷</span>
          <strong>השעות יופיעו כאן</strong>
          <p>בחרו תחילה יום פנוי בלוח.</p>
        </div> : <div className="spa-appointment__slots">
          <h3>בחרו שעה מועדפת</h3>
          <p className="spa-appointment__slot-help">לאחר חיבור מערכת ספא פלוס יוצגו כאן רק השעות הפנויות בפועל.</p>
          {timeGroups.map((group) => <div className="spa-appointment__slot-group" key={group.label}>
            <span>{group.label}</span>
            <div>{group.slots.map((time) => <button key={time} type="button" dir="ltr" aria-pressed={selectedTime === time} onClick={() => chooseTime(time)}>{time}</button>)}</div>
          </div>)}
          <button className="spa-appointment__flexible" type="button" aria-pressed={selectedTime === "גמישים בשעה"} onClick={() => chooseTime("גמישים בשעה")}>גמישים בשעה</button>
        </div>}
      </div>
    </div>

    <footer className="spa-appointment__note">
      <span aria-hidden="true">i</span>
      <p><strong>אלו שעות לבקשה, לא זמינות חיה.</strong> לאחר החיבור למערכת יוצגו שעות פנויות בזמן אמת. עד אז המקום מאמת את השעה לפני אישור ההזמנה.</p>
    </footer>
  </section>;
}
