import { parseCalendarDate } from "../lib/modern-date-model";

const bookingDateCopy = {
  he: { arrival: "תאריך כניסה", departure: "תאריך יציאה", date: "תאריך", time: "שעה" },
  en: { arrival: "Check-in date", departure: "Check-out date", date: "Date", time: "Time" },
  ru: { arrival: "Дата заезда", departure: "Дата выезда", date: "Дата", time: "Время" },
  fr: { arrival: "Date d’arrivée", departure: "Date de départ", date: "Date", time: "Heure" },
} as const;

export function BookingDateFields({ arrival, departure, time, language, stay }: {
  arrival: string;
  departure: string;
  time: string;
  language: keyof typeof bookingDateCopy;
  stay: boolean;
}) {
  const copy = bookingDateCopy[language];
  const dates = [
    { label: stay ? copy.arrival : copy.date, value: arrival },
    { label: copy.departure, value: departure },
  ].filter(({ value }) => parseCalendarDate(value) !== null);
  if (!dates.length) return null;
  return <>
    {dates.map(({ label, value }) => (
      <div key={label}>
        <dt>{label}</dt>
        <dd><time dateTime={value} dir="ltr">{value.split("-").reverse().join(".")}</time></dd>
      </div>
    ))}
    {time ? <div><dt>{copy.time}</dt><dd><time dateTime={time} dir="ltr">{time}</time></dd></div> : null}
  </>;
}

export function SavedBookingDateFields({ value, language, stay }: {
  value: string;
  language: keyof typeof bookingDateCopy;
  stay: boolean;
}) {
  const match = /^(\d{4}-\d{2}-\d{2})(?: עד (\d{4}-\d{2}-\d{2})| (\d{2}:\d{2}))?$/.exec(value.trim());
  if (match && parseCalendarDate(match[1]) && (!match[2] || parseCalendarDate(match[2]))) {
    const [, arrival, departure = "", time = ""] = match;
    return <BookingDateFields arrival={arrival} departure={departure} time={time} language={language} stay={stay} />;
  }
  return <div><dt>{bookingDateCopy[language].date}</dt><dd>{value}</dd></div>;
}
