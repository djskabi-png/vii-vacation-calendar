"use client";

import { useEffect, useMemo, useState } from "react";

type ContextMode = "home" | "property";
type HomeDateMode = "exact" | "flexible";
type GuestKey = "adults" | "children" | "infants" | "rooms";
type Guests = Record<GuestKey, number>;
type Availability = {
  kind: "past" | "busy" | "limited" | "open";
  units: number;
  label: string;
};

const DAY_MS = 86_400_000;
const DEMO_TODAY = new Date(2026, 7, 4);
const START_MONTH = new Date(2026, 7, 1);
const MAX_MONTH_OFFSET = 11;
const WEEKDAYS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
const DESTINATIONS = ["כל הארץ", "צפון", "כנרת", "אילת", "מרכז", "ירושלים", "ים המלח"];

const BUSINESS_BUSY_DATES = new Set([
  "2026-08-04",
  "2026-08-09",
  "2026-08-10",
  "2026-08-11",
  "2026-08-18",
  "2026-08-19",
  "2026-08-23",
  "2026-08-31",
  "2026-09-01",
  "2026-09-04",
  "2026-09-07",
]);

const BUSINESS_LIMITED_DATES = new Set([
  "2026-08-05",
  "2026-08-06",
  "2026-08-12",
  "2026-08-13",
  "2026-08-21",
  "2026-08-25",
  "2026-08-26",
  "2026-09-08",
  "2026-09-09",
]);

const FLEX_STAYS = [
  { id: "weekend", label: "סוף שבוע", description: "2 לילות", nights: 2 },
  { id: "long-weekend", label: "סוף שבוע ארוך", description: "3 לילות", nights: 3 },
  { id: "week", label: "שבוע", description: "7 לילות", nights: 7 },
  { id: "long-stay", label: "חופשה ארוכה", description: "10 לילות", nights: 10 },
] as const;

const QUICK_STAYS = [
  { id: "weekend", label: "סוף השבוע הקרוב", nights: 2, preferredDay: 4 },
  { id: "midweek", label: "אמצע השבוע", nights: 3, preferredDay: 0 },
  { id: "week", label: "שבוע מלא", nights: 7, preferredDay: 0 },
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

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("he-IL", { month: "long", year: "numeric" }).format(date);
}

function compactMonthLabel(date: Date) {
  return new Intl.DateTimeFormat("he-IL", { month: "long" }).format(date);
}

function shortDate(key: string | null) {
  if (!key) return "הוספת תאריך";
  return new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "short" }).format(dateFromKey(key));
}

function longDate(key: string | null) {
  if (!key) return "טרם נבחר";
  return new Intl.DateTimeFormat("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(dateFromKey(key));
}

function dateDiff(start: string, end: string) {
  return Math.round((dateFromKey(end).getTime() - dateFromKey(start).getTime()) / DAY_MS);
}

function monthOffsetFor(key: string) {
  const date = dateFromKey(key);
  return Math.max(
    0,
    (date.getFullYear() - START_MONTH.getFullYear()) * 12 + date.getMonth() - START_MONTH.getMonth(),
  );
}

function businessAvailability(date: Date): Availability {
  const key = keyOf(date);
  if (date < DEMO_TODAY) return { kind: "past", units: 0, label: "תאריך שעבר" };
  const pattern = (date.getDate() * 3 + date.getMonth() * 5 + date.getFullYear()) % 31;
  if (BUSINESS_BUSY_DATES.has(key) || pattern === 0 || pattern === 14) {
    return { kind: "busy", units: 0, label: "תפוס" };
  }
  if (BUSINESS_LIMITED_DATES.has(key) || pattern === 7 || pattern === 21) {
    return { kind: "limited", units: 1, label: "יחידה אחת פנויה" };
  }
  const units = 2 + (pattern % 3);
  return { kind: "open", units, label: `${units} יחידות פנויות` };
}

function generalAvailability(date: Date): Availability {
  if (date < DEMO_TODAY) return { kind: "past", units: 0, label: "תאריך שעבר" };
  return { kind: "open", units: 0, label: "זמין לבחירה" };
}

function minimumNightsFor(date: Date) {
  return date.getDay() === 4 || date.getDay() === 5 ? 2 : 1;
}

function businessRangeHasBusyDate(start: string, end: string) {
  const cursor = addDays(dateFromKey(start), 1);
  const finish = dateFromKey(end);
  while (cursor < finish) {
    const state = businessAvailability(cursor);
    if (state.kind === "busy" || state.kind === "past") return true;
    cursor.setDate(cursor.getDate() + 1);
  }
  return false;
}

function findGeneralRange(nights: number, preferredDay: number) {
  let candidate = addDays(DEMO_TODAY, 1);
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (candidate.getDay() === preferredDay) {
      return { start: keyOf(candidate), end: keyOf(addDays(candidate, nights)) };
    }
    candidate = addDays(candidate, 1);
  }
  return null;
}

function findBusinessRange(nights: number, preferredDay: number) {
  let candidate = addDays(DEMO_TODAY, 1);
  for (let attempt = 0; attempt < 180; attempt += 1) {
    const end = addDays(candidate, Math.max(nights, minimumNightsFor(candidate)));
    const startState = businessAvailability(candidate);
    const endState = businessAvailability(end);
    if (
      candidate.getDay() === preferredDay &&
      startState.kind !== "busy" &&
      endState.kind !== "busy" &&
      !businessRangeHasBusyDate(keyOf(candidate), keyOf(end))
    ) {
      return { start: keyOf(candidate), end: keyOf(end) };
    }
    candidate = addDays(candidate, 1);
  }
  return null;
}

function guestSummary(guests: Guests) {
  const people = guests.adults + guests.children;
  const parts = [`${people} אורחים`, `${guests.rooms} ${guests.rooms === 1 ? "חדר" : "חדרים"}`];
  if (guests.infants) parts.push(`${guests.infants} תינוקות`);
  return parts.join(", ");
}

function GuestRow({
  label,
  detail,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  detail: string;
  value: number;
  min: number;
  max: number;
  onChange: (nextValue: number) => void;
}) {
  return (
    <div className="guest-row">
      <div>
        <strong>{label}</strong>
        <small>{detail}</small>
      </div>
      <div className="stepper" aria-label={`כמות ${label}`}>
        <button type="button" onClick={() => onChange(value - 1)} disabled={value <= min} aria-label={`הפחתת ${label}`}>−</button>
        <span aria-live="polite">{value}</span>
        <button type="button" onClick={() => onChange(value + 1)} disabled={value >= max} aria-label={`הוספת ${label}`}>+</button>
      </div>
    </div>
  );
}

function CalendarMonth({
  month,
  contextMode,
  checkIn,
  checkOut,
  hoverDate,
  onDateClick,
  onDateHover,
  secondary = false,
}: {
  month: Date;
  contextMode: ContextMode;
  checkIn: string | null;
  checkOut: string | null;
  hoverDate: string | null;
  onDateClick: (date: Date) => void;
  onDateHover: (key: string | null) => void;
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
      <div className="days-grid" onMouseLeave={() => onDateHover(null)}>
        {cells.map((date, index) => {
          if (!date) return <span className="empty-day" key={`empty-${index}`} />;
          const key = keyOf(date);
          const availability = contextMode === "property" ? businessAvailability(date) : generalAvailability(date);
          const minNights = contextMode === "property" ? minimumNightsFor(date) : 1;
          const isStart = key === checkIn;
          const isEnd = key === checkOut;
          const inRange = Boolean(checkIn && checkOut && key > checkIn && key < checkOut);
          const previewRange = Boolean(
            checkIn && !checkOut && hoverDate && hoverDate > checkIn && key > checkIn && key < hoverDate,
          );
          const disabled = availability.kind === "past" || availability.kind === "busy";
          const detail = contextMode === "property"
            ? availability.kind === "busy"
              ? "תפוס"
              : availability.kind === "past"
                ? ""
                : availability.kind === "limited"
                  ? "1 פנויה"
                  : `${availability.units} פנויות`
            : "";

          return (
            <button
              type="button"
              className={[
                "day",
                `is-${availability.kind}`,
                contextMode === "home" ? "general-day" : "business-day",
                isStart ? "is-start" : "",
                isEnd ? "is-end" : "",
                inRange ? "is-range" : "",
                previewRange ? "is-preview" : "",
              ].filter(Boolean).join(" ")}
              key={key}
              onClick={() => onDateClick(date)}
              onMouseEnter={() => !disabled && onDateHover(key)}
              onFocus={() => !disabled && onDateHover(key)}
              onBlur={() => onDateHover(null)}
              disabled={disabled}
              aria-pressed={isStart || isEnd}
              aria-label={`${date.getDate()} ${monthLabel(month)}, ${availability.label}${contextMode === "property" && minNights > 1 ? `, מינימום ${minNights} לילות` : ""}`}
            >
              <span className="day-number">{date.getDate()}</span>
              {contextMode === "property" && (
                <span className="availability">
                  {availability.kind !== "past" && <span className="availability-dot" />}
                  {detail}
                </span>
              )}
              {contextMode === "property" && minNights > 1 && availability.kind !== "past" && availability.kind !== "busy" && (
                <span className="minimum-note">מינ׳ {minNights}</span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default function Home() {
  const [contextMode, setContextMode] = useState<ContextMode>("home");
  const [homeDateMode, setHomeDateMode] = useState<HomeDateMode>("exact");
  const [monthOffset, setMonthOffset] = useState(0);
  const [homeCheckIn, setHomeCheckIn] = useState<string | null>(null);
  const [homeCheckOut, setHomeCheckOut] = useState<string | null>(null);
  const [propertyCheckIn, setPropertyCheckIn] = useState<string | null>(null);
  const [propertyCheckOut, setPropertyCheckOut] = useState<string | null>(null);
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const [destination, setDestination] = useState("כל הארץ");
  const [destinationPanelOpen, setDestinationPanelOpen] = useState(false);
  const [guestPanelOpen, setGuestPanelOpen] = useState(false);
  const [guests, setGuests] = useState<Guests>({ adults: 2, children: 0, infants: 0, rooms: 1 });
  const [accessibleStay, setAccessibleStay] = useState(false);
  const [flexStay, setFlexStay] = useState<(typeof FLEX_STAYS)[number]["id"]>("weekend");
  const [flexMonth, setFlexMonth] = useState(0);
  const [flexibility, setFlexibility] = useState(3);
  const [notice, setNotice] = useState("בחרו תאריך הגעה");
  const [confirmed, setConfirmed] = useState(false);

  const firstMonth = addMonths(START_MONTH, monthOffset);
  const secondMonth = addMonths(firstMonth, 1);
  const flexibleMonths = Array.from({ length: 6 }, (_, index) => addMonths(START_MONTH, index));
  const selectedFlexStay = FLEX_STAYS.find((stay) => stay.id === flexStay) ?? FLEX_STAYS[0];
  const activeCheckIn = contextMode === "home" ? homeCheckIn : propertyCheckIn;
  const activeCheckOut = contextMode === "home" ? homeCheckOut : propertyCheckOut;
  const nights = activeCheckIn && activeCheckOut ? dateDiff(activeCheckIn, activeCheckOut) : 0;
  const selectedMinimum = propertyCheckIn ? minimumNightsFor(dateFromKey(propertyCheckIn)) : 1;
  const propertyReady = Boolean(propertyCheckIn && propertyCheckOut && nights >= selectedMinimum);
  const homeReady = homeDateMode === "flexible" || Boolean(homeCheckIn && homeCheckOut);
  const canContinue = contextMode === "home" ? homeReady : propertyReady;

  useEffect(() => {
    function closeWithEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setGuestPanelOpen(false);
        setDestinationPanelOpen(false);
      }
    }
    window.addEventListener("keydown", closeWithEscape);
    return () => window.removeEventListener("keydown", closeWithEscape);
  }, []);

  function switchContext(nextContext: ContextMode) {
    setContextMode(nextContext);
    setConfirmed(false);
    setGuestPanelOpen(false);
    setDestinationPanelOpen(false);
    setHoverDate(null);
    setMonthOffset(0);
    setNotice("בחרו תאריך הגעה");
  }

  function chooseHomeDate(date: Date) {
    const key = keyOf(date);
    setConfirmed(false);
    if (!homeCheckIn || homeCheckOut) {
      setHomeCheckIn(key);
      setHomeCheckOut(null);
      setNotice("עכשיו בחרו תאריך עזיבה");
      return;
    }
    if (key <= homeCheckIn) {
      setHomeCheckIn(key);
      setHomeCheckOut(null);
      setNotice("תאריך ההגעה עודכן, עכשיו בחרו עזיבה");
      return;
    }
    setHomeCheckOut(key);
    setNotice("הטווח מוכן לחיפוש בכל האתר");
  }

  function choosePropertyDate(date: Date) {
    const key = keyOf(date);
    setConfirmed(false);
    if (!propertyCheckIn || propertyCheckOut) {
      setPropertyCheckIn(key);
      setPropertyCheckOut(null);
      const minimum = minimumNightsFor(date);
      setNotice(minimum > 1 ? `לתאריך הזה נדרשים לפחות ${minimum} לילות` : "עכשיו בחרו תאריך עזיבה");
      return;
    }
    if (key <= propertyCheckIn) {
      setPropertyCheckIn(key);
      setPropertyCheckOut(null);
      const minimum = minimumNightsFor(date);
      setNotice(minimum > 1 ? `לתאריך הזה נדרשים לפחות ${minimum} לילות` : "תאריך ההגעה עודכן");
      return;
    }
    if (businessRangeHasBusyDate(propertyCheckIn, key)) {
      setNotice("יש יום תפוס בתוך הטווח, בחרו טווח אחר");
      return;
    }
    setPropertyCheckOut(key);
    const selectedNights = dateDiff(propertyCheckIn, key);
    const minimum = minimumNightsFor(dateFromKey(propertyCheckIn));
    setNotice(
      selectedNights < minimum
        ? `העסק דורש מינימום ${minimum} לילות לתאריך ההגעה שבחרתם`
        : "הטווח עומד בתנאי המקום ומוכן להמשך",
    );
  }

  function applyQuickStay(id: (typeof QUICK_STAYS)[number]["id"]) {
    const preset = QUICK_STAYS.find((stay) => stay.id === id);
    if (!preset) return;
    const range = contextMode === "property"
      ? findBusinessRange(preset.nights, preset.preferredDay)
      : findGeneralRange(preset.nights, preset.preferredDay);
    if (!range) {
      setNotice("לא נמצא טווח מתאים באפשרויות ההמחשה");
      return;
    }
    if (contextMode === "property") {
      setPropertyCheckIn(range.start);
      setPropertyCheckOut(range.end);
      setNotice("נמצא טווח פנוי שעומד בתנאי המקום");
    } else {
      setHomeCheckIn(range.start);
      setHomeCheckOut(range.end);
      setNotice("הטווח מוכן לחיפוש בכל האתר");
    }
    setMonthOffset(monthOffsetFor(range.start));
    setConfirmed(false);
  }

  function updateGuests(key: GuestKey, nextValue: number) {
    setGuests((current) => ({ ...current, [key]: nextValue }));
    setConfirmed(false);
  }

  function resetSelection() {
    if (contextMode === "property") {
      setPropertyCheckIn(null);
      setPropertyCheckOut(null);
    } else {
      setHomeCheckIn(null);
      setHomeCheckOut(null);
    }
    setHoverDate(null);
    setConfirmed(false);
    setNotice("בחרו תאריך הגעה");
  }

  function confirmSelection() {
    setGuestPanelOpen(false);
    setDestinationPanelOpen(false);
    setConfirmed(true);
  }

  const selectionTitle = confirmed
    ? contextMode === "home"
      ? "החיפוש הכללי מוכן"
      : "בחירת העסק מוכנה"
    : homeDateMode === "flexible" && contextMode === "home"
      ? `${selectedFlexStay.label} ב${compactMonthLabel(flexibleMonths[flexMonth])}`
      : activeCheckIn && activeCheckOut
        ? contextMode === "property" && nights < selectedMinimum
          ? notice
          : nights === 1
            ? "לילה אחד נבחר"
            : `${nights} לילות נבחרו`
        : notice;

  const selectionDetail = confirmed
    ? contextMode === "home"
      ? `בגרסה המחוברת יוצגו כל המקומות המתאימים ב${destination}`
      : "בגרסה המחוברת יוצגו היחידות והמחיר הזמינים במקום"
    : homeDateMode === "flexible" && contextMode === "home"
      ? `גמישות של עד ${flexibility === 0 ? "ללא שינוי" : `${flexibility} ימים`}, ${guestSummary(guests)}`
      : activeCheckIn && activeCheckOut
        ? `${longDate(activeCheckIn)} עד ${longDate(activeCheckOut)}`
        : contextMode === "home"
          ? "אין מגבלות זמינות של עסק מסוים בשלב החיפוש"
          : "הזמינות והמגבלות כאן שייכות למקום שנבחר";

  return (
    <main className={`page-shell context-${contextMode}`} dir="rtl">
      <a className="skip-link" href="#picker-content">דילוג לבחירת התאריכים</a>
      <div className="brand-stripe" aria-hidden="true" />

      <section className="booking-shell" aria-labelledby="picker-title">
        <header className="topbar">
          <a className="official-brand" href="https://www.vii.co.il" target="_blank" rel="noreferrer" aria-label="מעבר לאתר וי פור ויקיישן">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="./vii-logo.png" alt="וי פור ויקיישן" width="160" height="122" />
          </a>
          <nav className="context-switch" aria-label="בחירת סוג היומן">
            <button
              type="button"
              className={contextMode === "home" ? "active" : ""}
              aria-current={contextMode === "home" ? "page" : undefined}
              onClick={() => switchContext("home")}
            >
              <span>חיפוש כללי</span>
              <small>לדף הבית</small>
            </button>
            <button
              type="button"
              className={contextMode === "property" ? "active" : ""}
              aria-current={contextMode === "property" ? "page" : undefined}
              onClick={() => switchContext("property")}
            >
              <span>זמינות במקום</span>
              <small>לדף עסק</small>
            </button>
          </nav>
          <div className="top-actions">
            <span className="demo-badge">המחשה אינטראקטיבית</span>
            <a href="https://www.vii.co.il" target="_blank" rel="noreferrer">לאתר הראשי</a>
          </div>
        </header>

        <section className="booking-intro">
          <div className="headline-block">
            <span className="eyebrow">{contextMode === "home" ? "חיפוש בכל אתר הנופש" : "יומן של מקום אירוח"}</span>
            <h1 id="picker-title">{contextMode === "home" ? "מוצאים את החופשה שמתאימה לכם" : "בודקים זמינות בהילת הנוף"}</h1>
            <p>
              {contextMode === "home"
                ? "בוחרים יעד, תאריכים והרכב. החיפוש עובר על כל המקומות באתר ולכן אין כאן תפוס או מינימום לילות של עסק מסוים."
                : "כאן הבחירה מתייחסת למקום אחד. ימים תפוסים, מספר היחידות ומינימום הלילות משפיעים על הטווח שאפשר להזמין."}
            </p>
          </div>

          <div className="search-area">
            {contextMode === "home" && (
              <div className="home-date-tabs" role="tablist" aria-label="סוג בחירת התאריכים">
                <button type="button" role="tab" aria-selected={homeDateMode === "exact"} className={homeDateMode === "exact" ? "active" : ""} onClick={() => { setHomeDateMode("exact"); setConfirmed(false); }}>תאריכים מדויקים</button>
                <button type="button" role="tab" aria-selected={homeDateMode === "flexible"} className={homeDateMode === "flexible" ? "active" : ""} onClick={() => { setHomeDateMode("flexible"); setConfirmed(false); }}>אני גמיש</button>
              </div>
            )}

            {contextMode === "property" && (
              <div className="property-identity" aria-label="פרטי המקום">
                <span className="property-avatar">ה</span>
                <span>
                  <strong>הילת הנוף</strong>
                  <small>כלנית, 4 בקתות עץ</small>
                </span>
                <span className="verified-label">דף עסק</span>
              </div>
            )}

            <div className={`search-fields ${contextMode === "property" ? "property-search-fields" : ""}`}>
              {contextMode === "home" && (
                <div className="destination-field-wrap">
                  <button
                    type="button"
                    className="search-field filled"
                    aria-expanded={destinationPanelOpen}
                    onClick={() => { setDestinationPanelOpen((open) => !open); setGuestPanelOpen(false); }}
                  >
                    <span>איפה</span>
                    <strong>{destination}</strong>
                    <small>אזור או יעד מועדף</small>
                  </button>
                  {destinationPanelOpen && (
                    <div className="destination-panel" role="dialog" aria-label="בחירת יעד">
                      <strong>לאן תרצו לצאת?</strong>
                      <div className="destination-options">
                        {DESTINATIONS.map((item) => (
                          <button
                            type="button"
                            key={item}
                            className={destination === item ? "selected" : ""}
                            onClick={() => { setDestination(item); setDestinationPanelOpen(false); setConfirmed(false); }}
                          >
                            <span>{item}</span>
                            <small>{item === "כל הארץ" ? "הכי הרבה אפשרויות" : `חופשה ב${item}`}</small>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <button type="button" className={`search-field${activeCheckIn ? " filled" : ""}`} onClick={() => { if (contextMode === "home") setHomeDateMode("exact"); }}>
                <span>{contextMode === "home" && homeDateMode === "flexible" ? "מתי" : "הגעה"}</span>
                <strong>{contextMode === "home" && homeDateMode === "flexible" ? compactMonthLabel(flexibleMonths[flexMonth]) : shortDate(activeCheckIn)}</strong>
                <small>{contextMode === "home" && homeDateMode === "flexible" ? "החודש המועדף" : longDate(activeCheckIn)}</small>
              </button>

              <button type="button" className={`search-field${activeCheckOut ? " filled" : ""}`} onClick={() => { if (contextMode === "home") setHomeDateMode("exact"); }}>
                <span>{contextMode === "home" && homeDateMode === "flexible" ? "משך" : "עזיבה"}</span>
                <strong>{contextMode === "home" && homeDateMode === "flexible" ? selectedFlexStay.description : shortDate(activeCheckOut)}</strong>
                <small>{contextMode === "home" && homeDateMode === "flexible" ? `עד ${flexibility} ימים לכל כיוון` : longDate(activeCheckOut)}</small>
              </button>

              <div className="guest-field-wrap">
                <button
                  type="button"
                  className="search-field guest-field filled"
                  aria-expanded={guestPanelOpen}
                  onClick={() => { setGuestPanelOpen((open) => !open); setDestinationPanelOpen(false); }}
                >
                  <span>אורחים וחדרים</span>
                  <strong>{guests.adults + guests.children} אורחים</strong>
                  <small>{accessibleStay ? "נדרשת נגישות" : `${guests.rooms} ${guests.rooms === 1 ? "חדר" : "חדרים"}`}</small>
                </button>

                {guestPanelOpen && (
                  <div className="guest-panel" role="dialog" aria-label="בחירת הרכב אורחים">
                    <div className="panel-head">
                      <div>
                        <strong>מי יוצא לחופשה?</strong>
                        <small>אפשר לעדכן את ההרכב בכל שלב</small>
                      </div>
                      <button type="button" onClick={() => setGuestPanelOpen(false)} aria-label="סגירת בחירת האורחים">×</button>
                    </div>
                    <GuestRow label="מבוגרים" detail="מגיל 18" value={guests.adults} min={1} max={12} onChange={(value) => updateGuests("adults", value)} />
                    <GuestRow label="ילדים" detail="גיל 2 עד 17" value={guests.children} min={0} max={8} onChange={(value) => updateGuests("children", value)} />
                    <GuestRow label="תינוקות" detail="עד גיל שנתיים" value={guests.infants} min={0} max={5} onChange={(value) => updateGuests("infants", value)} />
                    <GuestRow label="חדרים" detail="מספר יחידות מבוקש" value={guests.rooms} min={1} max={4} onChange={(value) => updateGuests("rooms", value)} />
                    <label className="accessibility-check">
                      <input type="checkbox" checked={accessibleStay} onChange={(event) => setAccessibleStay(event.target.checked)} />
                      <span>
                        <strong>נדרש מקום אירוח נגיש</strong>
                        <small>הבחירה תועבר לסינון המתאים</small>
                      </span>
                    </label>
                    <button type="button" className="panel-done" onClick={() => setGuestPanelOpen(false)}>סיום</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="picker-content" id="picker-content">
          {contextMode === "home" && homeDateMode === "flexible" ? (
            <div className="flexible-picker">
              <div className="flexible-heading">
                <span className="section-kicker">חיפוש גמיש בכל האתר</span>
                <h2>ספרו לנו מה בערך מתאים</h2>
                <p>אין כאן חסימות של מקום מסוים. נשתמש בהעדפות כדי להרחיב את תוצאות החיפוש.</p>
              </div>

              <div className="flex-group">
                <h3>כמה זמן תרצו להתארח?</h3>
                <div className="stay-options">
                  {FLEX_STAYS.map((stay) => (
                    <button type="button" key={stay.id} className={flexStay === stay.id ? "selected" : ""} onClick={() => { setFlexStay(stay.id); setConfirmed(false); }}>
                      <span>{stay.label}</span>
                      <strong>{stay.description}</strong>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-group">
                <h3>באיזה חודש?</h3>
                <div className="month-options">
                  {flexibleMonths.map((month, index) => (
                    <button type="button" key={keyOf(month)} className={flexMonth === index ? "selected" : ""} onClick={() => { setFlexMonth(index); setConfirmed(false); }}>
                      <span>{compactMonthLabel(month)}</span>
                      <small>{month.getFullYear()}</small>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-group compact">
                <h3>כמה גמישות יש לכם?</h3>
                <div className="flexibility-options">
                  {[0, 1, 3, 7].map((days) => (
                    <button type="button" key={days} className={flexibility === days ? "selected" : ""} onClick={() => { setFlexibility(days); setConfirmed(false); }}>
                      {days === 0 ? "ללא גמישות" : `${days} ${days === 1 ? "יום" : "ימים"} לכל כיוון`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="calendar-heading-row">
                <div>
                  <span className="section-kicker">{contextMode === "home" ? "תאריכים לחיפוש כללי" : "זמינות המקום"}</span>
                  <h2 className="section-title">{contextMode === "home" ? "בחרו הגעה ועזיבה" : "בחרו טווח שעומד בתנאי המקום"}</h2>
                </div>
                <div className="calendar-nav">
                  <button type="button" onClick={() => setMonthOffset((value) => Math.max(0, value - 1))} disabled={monthOffset === 0} aria-label="החודש הקודם">→</button>
                  <span>{monthLabel(firstMonth)}</span>
                  <button type="button" onClick={() => setMonthOffset((value) => Math.min(MAX_MONTH_OFFSET, value + 1))} disabled={monthOffset === MAX_MONTH_OFFSET} aria-label="החודש הבא">←</button>
                </div>
              </div>

              <div className="quick-stays" aria-label="אפשרויות חופשה מהירות">
                <span>{contextMode === "home" ? "חיפוש מהיר:" : "מציאת טווח פנוי:"}</span>
                {QUICK_STAYS.map((stay) => (
                  <button type="button" key={stay.id} onClick={() => applyQuickStay(stay.id)}>{stay.label}</button>
                ))}
              </div>

              {contextMode === "property" && (
                <div className="property-rules" aria-label="כללי הזמינות בהמחשה">
                  <span><strong>4</strong> יחידות במקום</span>
                  <span><strong>תפוס</strong> לא ניתן לבחירה</span>
                  <span><strong>מינ׳</strong> לפי יום ההגעה</span>
                  <span className="illustration-note">הזמינות והמגבלות להמחשה בלבד</span>
                </div>
              )}

              <div className="months-grid">
                <CalendarMonth
                  month={firstMonth}
                  contextMode={contextMode}
                  checkIn={activeCheckIn}
                  checkOut={activeCheckOut}
                  hoverDate={hoverDate}
                  onDateClick={contextMode === "home" ? chooseHomeDate : choosePropertyDate}
                  onDateHover={setHoverDate}
                />
                <CalendarMonth
                  month={secondMonth}
                  contextMode={contextMode}
                  checkIn={activeCheckIn}
                  checkOut={activeCheckOut}
                  hoverDate={hoverDate}
                  onDateClick={contextMode === "home" ? chooseHomeDate : choosePropertyDate}
                  onDateHover={setHoverDate}
                  secondary
                />
              </div>

              <div className="legend" aria-label="מקרא היומן">
                {contextMode === "home" ? (
                  <>
                    <span><i className="dot general" /> כל תאריך עתידי ניתן לחיפוש</span>
                    <span className="illustration-note">הזמינות תיבדק מול כל המקומות בתוצאות</span>
                  </>
                ) : (
                  <>
                    <span><i className="dot open" /> פנוי</span>
                    <span><i className="dot limited" /> יחידה אחרונה</span>
                    <span><i className="dot busy" /> תפוס</span>
                    <span><i className="minimum-sample">מינ׳ 2</i> מינימום לילות</span>
                  </>
                )}
              </div>
            </>
          )}
        </section>

        <footer className="booking-footer">
          <div className="selection-status" aria-live="polite">
            <span className={`status-mark${confirmed ? " confirmed" : ""}`}>{confirmed ? "✓" : contextMode === "home" ? "ח" : "ע"}</span>
            <span>
              <strong>{selectionTitle}</strong>
              <small>{selectionDetail}</small>
            </span>
          </div>
          <div className="footer-actions">
            <button type="button" className="reset-button" onClick={resetSelection} disabled={!activeCheckIn && !activeCheckOut}>ניקוי</button>
            <button type="button" className="continue-button" onClick={confirmSelection} disabled={!canContinue}>
              {contextMode === "home" ? "חיפוש מקומות אירוח" : "הצגת יחידות זמינות"}
              <span aria-hidden="true">←</span>
            </button>
          </div>
        </footer>
      </section>

      <footer className="site-footer">
        <span>המחשת חיפוש ויומן זמינות עבור וי פור ויקיישן</span>
        <a href="https://www.vii.co.il" target="_blank" rel="noreferrer">מעבר לאתר הקיים</a>
      </footer>
    </main>
  );
}
