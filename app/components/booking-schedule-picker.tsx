"use client";

import { useMemo, useState } from "react";
import { CalendarIcon } from "../site-header";
import { useSiteLanguage } from "../i18n/locale-provider";
import { ModernSelect } from "./modern-select";

const ARRIVAL_PREFERENCES = [
  { value: "", label: "ללא העדפה" },
  { value: "check_in", label: "בשעת הצ׳ק־אין" },
  { value: "within_hour", label: "עד שעה אחרי הצ׳ק־אין" },
  { value: "later", label: "שעה עד שלוש שעות אחרי הצ׳ק־אין" },
  { value: "late", label: "הגעה מאוחרת יותר" },
];

function dateKey(date: Date) {
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
}

function fromKey(value?: string) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function monthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function BookingSchedulePicker({ range, arrival, departure, time, onArrivalChange, onDepartureChange, onTimeChange }: {
  range: boolean;
  arrival: string;
  departure: string;
  time: string;
  onArrivalChange: (value: string) => void;
  onDepartureChange: (value: string) => void;
  onTimeChange: (value: string) => void;
}) {
  const { language, translate } = useSiteLanguage();
  const locale = { he: "he-IL", en: "en-GB", ru: "ru-RU", fr: "fr-FR" }[language];
  const today = useMemo(() => new Date(), []);
  const initialMonth = fromKey(arrival) || today;
  const [month, setMonth] = useState(() => monthStart(initialMonth));
  const weekdays = useMemo(() => Array.from({ length: 7 }, (_, index) => new Intl.DateTimeFormat(locale, { weekday: "narrow" }).format(new Date(2026, 7, 2 + index))), [locale]);
  const cells = useMemo(() => {
    const values: Array<Date | null> = Array(month.getDay()).fill(null);
    const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    for (let day = 1; day <= count; day += 1) values.push(new Date(month.getFullYear(), month.getMonth(), day));
    return values;
  }, [month]);
  const monthTitle = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(month);
  const minimumMonth = monthStart(today);

  function chooseDate(date: Date) {
    const key = dateKey(date);
    if (!range) {
      onArrivalChange(key);
      return;
    }
    if (!arrival || departure || key <= arrival) {
      onArrivalChange(key);
      onDepartureChange("");
      return;
    }
    onDepartureChange(key);
  }

  return <div className="booking-schedule form-wide">
    <div className="booking-schedule__heading">
      <CalendarIcon />
      <div><strong>{translate(range ? "בחרו תאריכי שהייה" : "בחרו תאריך הגעה")}</strong><span>{translate(range ? "תחילה הגעה, אחר כך עזיבה" : "בחרו יום פנוי בלוח")}</span></div>
    </div>
    <div className="booking-schedule__calendar" aria-label={translate("בחירת תאריך")}>
      <header><button type="button" disabled={month <= minimumMonth} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label={translate("החודש הקודם")}>‹</button><strong>{monthTitle}</strong><button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label={translate("החודש הבא")}>›</button></header>
      <div className="booking-schedule__weekdays" aria-hidden="true">{weekdays.map((day, index) => <span key={day + "-" + index}>{day}</span>)}</div>
      <div className="booking-schedule__days">{cells.map((date, index) => {
        if (!date) return <span key={"blank-" + index} />;
        const key = dateKey(date);
        const past = date < new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const selected = key === arrival || key === departure;
        const between = Boolean(arrival && departure && key > arrival && key < departure);
        return <button type="button" key={key} disabled={past} aria-pressed={selected} className={(selected ? "selected" : "") + (between ? " between" : "")} onClick={() => chooseDate(date)}><span>{date.getDate()}</span></button>;
      })}</div>
    </div>
    <div className="booking-schedule__summary" aria-live="polite">
      <span><small>{translate("הגעה")}</small><strong>{arrival ? new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(fromKey(arrival)!) : translate("בחרו תאריך")}</strong></span>
      {range ? <span><small>{translate("עזיבה")}</small><strong>{departure ? new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(fromKey(departure)!) : translate("בחרו תאריך")}</strong></span> : null}
    </div>
    <div className="booking-schedule__time-optional">
      <ModernSelect
        compact
        label={translate("שעת הגעה משוערת, לא חובה")}
        value={time}
        onChange={onTimeChange}
        options={ARRIVAL_PREFERENCES.map((option) => ({ value: option.value, label: translate(option.label) }))}
      />
      <p>{translate("שעת הצ׳ק־אין המדויקת מופיעה באישור המקום. אין להגיע לפני השעה שאושרה.")}</p>
    </div>
    <input type="hidden" name="date" value={arrival} />
    {range ? <input type="hidden" name="till" value={departure} /> : null}
    <input type="hidden" name="time" value={time} />
  </div>;
}
