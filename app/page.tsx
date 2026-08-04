"use client";

import { useEffect, useMemo, useState } from "react";

type Availability = {
  kind: "past" | "busy" | "limited" | "open";
  units: number;
  label: string;
};

type GuestKey = "adults" | "children" | "infants" | "pets";

type Guests = Record<GuestKey, number>;

const DAY_MS = 86_400_000;
const DEMO_TODAY = new Date(2026, 7, 4);
const START_MONTH = new Date(2026, 7, 1);
const MAX_MONTH_OFFSET = 11;
const WEEKDAYS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
const FIXED_BUSY_DATES = new Set([
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
const FIXED_LIMITED_DATES = new Set([
  "2026-08-05",
  "2026-08-06",
  "2026-08-12",
  "2026-08-13",
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
  { id: "next-week", label: "אמצע השבוע", nights: 4, preferredDay: 0 },
  { id: "full-week", label: "שבוע מלא", nights: 7, preferredDay: 0 },
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

function availabilityFor(date: Date): Availability {
  const key = keyOf(date);
  if (date < DEMO_TODAY) return { kind: "past", units: 0, label: "תאריך שעבר" };

  const pattern = (date.getDate() * 3 + date.getMonth() * 5 + date.getFullYear()) % 29;
  if (FIXED_BUSY_DATES.has(key) || pattern === 0 || pattern === 13) {
    return { kind: "busy", units: 0, label: "אין זמינות" };
  }
  if (FIXED_LIMITED_DATES.has(key) || pattern === 7 || pattern === 19) {
    return { kind: "limited", units: 1, label: "נותרה אפשרות אחת" };
  }
  const units = 2 + (pattern % 4);
  return { kind: "open", units, label: `${units} אפשרויות זמינות` };
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("he-IL", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function compactMonthLabel(date: Date) {
  return new Intl.DateTimeFormat("he-IL", { month: "long" }).format(date);
}

function shortDate(key: string | null) {
  if (!key) return "הוספת תאריך";
  return new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "short",
  }).format(dateFromKey(key));
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

function rangeHasBlockedDate(start: string, end: string) {
  const cursor = addDays(dateFromKey(start), 1);
  const finish = dateFromKey(end);
  while (cursor < finish) {
    const state = availabilityFor(cursor);
    if (state.kind === "busy" || state.kind === "past") return true;
    cursor.setDate(cursor.getDate() + 1);
  }
  return false;
}

function findAvailableRange(nights: number, preferredDay: number) {
  let candidate = addDays(DEMO_TODAY, 1);
  for (let attempt = 0; attempt < 160; attempt += 1) {
    const end = addDays(candidate, nights);
    const startState = availabilityFor(candidate);
    const endState = availabilityFor(end);
    if (
      candidate.getDay() === preferredDay &&
      startState.kind !== "busy" &&
      endState.kind !== "busy" &&
      !rangeHasBlockedDate(keyOf(candidate), keyOf(end))
    ) {
      return { start: keyOf(candidate), end: keyOf(end) };
    }
    candidate = addDays(candidate, 1);
  }
  return null;
}

function guestSummary(guests: Guests) {
  const people = guests.adults + guests.children;
  const parts = [`${people} אורחים`];
  if (guests.infants) parts.push(`${guests.infants} תינוקות`);
  if (guests.pets) parts.push(`${guests.pets} חיות מחמד`);
  return parts.join(", ");
}

function CalendarMonth({
  month,
  checkIn,
  checkOut,
  hoverDate,
  onDateClick,
  onDateHover,
  secondary = false,
}: {
  month: Date;
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
          const availability = availabilityFor(date);
          const isStart = key === checkIn;
          const isEnd = key === checkOut;
          const inRange = Boolean(checkIn && checkOut && key > checkIn && key < checkOut);
          const previewRange = Boolean(
            checkIn && !checkOut && hoverDate && hoverDate > checkIn && key > checkIn && key < hoverDate,
          );
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
                previewRange ? "is-preview" : "",
              ].filter(Boolean).join(" ")}
              key={key}
              onClick={() => onDateClick(date)}
              onMouseEnter={() => !disabled && onDateHover(key)}
              onFocus={() => !disabled && onDateHover(key)}
              onBlur={() => onDateHover(null)}
              disabled={disabled}
              aria-pressed={isStart || isEnd}
              aria-label={`${date.getDate()} ${monthLabel(month)}, ${availability.label}`}
            >
              <span className="day-number">{date.getDate()}</span>
              <span className="availability">
                {availability.kind !== "past" && <span className="availability-dot" />}
                {availability.kind === "busy" ? "תפוס" : availability.kind === "past" ? "" : availability.units}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
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

export default function Home() {
  const [mode, setMode] = useState<"exact" | "flexible">("exact");
  const [monthOffset, setMonthOffset] = useState(0);
  const [checkIn, setCheckIn] = useState<string | null>(null);
  const [checkOut, setCheckOut] = useState<string | null>(null);
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const [notice, setNotice] = useState("בחרו תאריך הגעה");
  const [guestPanelOpen, setGuestPanelOpen] = useState(false);
  const [guests, setGuests] = useState<Guests>({ adults: 2, children: 0, infants: 0, pets: 0 });
  const [accessibleStay, setAccessibleStay] = useState(false);
  const [flexStay, setFlexStay] = useState<(typeof FLEX_STAYS)[number]["id"]>("weekend");
  const [flexMonth, setFlexMonth] = useState(0);
  const [flexibility, setFlexibility] = useState(3);
  const [confirmed, setConfirmed] = useState(false);

  const firstMonth = addMonths(START_MONTH, monthOffset);
  const secondMonth = addMonths(firstMonth, 1);
  const flexibleMonths = Array.from({ length: 6 }, (_, index) => addMonths(START_MONTH, index));
  const selectedFlexStay = FLEX_STAYS.find((stay) => stay.id === flexStay) ?? FLEX_STAYS[0];
  const nights = checkIn && checkOut ? dateDiff(checkIn, checkOut) : 0;
  const exactReady = Boolean(checkIn && checkOut);
  const canContinue = mode === "flexible" || exactReady;

  useEffect(() => {
    function closeWithEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setGuestPanelOpen(false);
    }
    window.addEventListener("keydown", closeWithEscape);
    return () => window.removeEventListener("keydown", closeWithEscape);
  }, []);

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
      setNotice("תאריך ההגעה עודכן, עכשיו בחרו עזיבה");
      return;
    }

    if (rangeHasBlockedDate(checkIn, key)) {
      setNotice("יש תאריך תפוס בתוך הטווח, נסו טווח אחר");
      return;
    }

    setCheckOut(key);
    setNotice("הטווח מוכן, אפשר להמשיך");
  }

  function applyQuickStay(id: (typeof QUICK_STAYS)[number]["id"]) {
    const preset = QUICK_STAYS.find((stay) => stay.id === id);
    if (!preset) return;
    const range = findAvailableRange(preset.nights, preset.preferredDay);
    if (!range) {
      setNotice("לא נמצא טווח מתאים באפשרויות ההדגמה");
      return;
    }
    setCheckIn(range.start);
    setCheckOut(range.end);
    setMonthOffset(Math.max(0, (dateFromKey(range.start).getFullYear() - START_MONTH.getFullYear()) * 12 + dateFromKey(range.start).getMonth() - START_MONTH.getMonth()));
    setNotice(`${preset.label} נבחר, אפשר להמשיך`);
    setConfirmed(false);
  }

  function updateGuests(key: GuestKey, nextValue: number) {
    setGuests((current) => ({ ...current, [key]: nextValue }));
    setConfirmed(false);
  }

  function resetSelection() {
    setCheckIn(null);
    setCheckOut(null);
    setHoverDate(null);
    setConfirmed(false);
    setNotice("בחרו תאריך הגעה");
  }

  function confirmSelection() {
    setGuestPanelOpen(false);
    setConfirmed(true);
  }

  const selectionTitle = mode === "exact"
    ? exactReady
      ? `${nights} לילות נבחרו`
      : notice
    : `${selectedFlexStay.label} ב${compactMonthLabel(flexibleMonths[flexMonth])}`;

  const selectionDetail = mode === "exact"
    ? exactReady
      ? `${longDate(checkIn)} עד ${longDate(checkOut)}`
      : "אפשר לבחור גם אחת מהאפשרויות המהירות"
    : `גמישות של עד ${flexibility === 0 ? "ללא שינוי" : `${flexibility} ימים`}, ${guestSummary(guests)}`;

  return (
    <main className="page-shell" dir="rtl">
      <a className="skip-link" href="#calendar-content">דילוג לבחירת התאריכים</a>
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <section className="booking-shell" aria-labelledby="picker-title">
        <header className="topbar">
          <div className="brand" aria-label="VII">
            <span className="brand-mark">V</span>
            <span className="brand-copy">
              <strong>VII</strong>
              <small>מתכננים חופשה שמתאימה לכם</small>
            </span>
          </div>
          <div className="top-actions">
            <span className="demo-badge">גרסת הדגמה</span>
            <a href="https://www.vii.co.il" target="_blank" rel="noreferrer">לאתר הראשי</a>
          </div>
        </header>

        <section className="booking-intro">
          <div className="headline-block">
            <span className="eyebrow">בחירת חופשה חכמה</span>
            <h1 id="picker-title">מתי נוח לכם לצאת?</h1>
            <p>בחרו תאריכים מדויקים, או תנו לנו למצוא עבורכם טווח גמיש שמתאים להרכב שלכם.</p>
          </div>

          <div className="mode-and-search">
            <div className="mode-tabs" role="tablist" aria-label="סוג בחירת התאריכים">
              <button
                type="button"
                role="tab"
                aria-selected={mode === "exact"}
                className={mode === "exact" ? "active" : ""}
                onClick={() => { setMode("exact"); setConfirmed(false); }}
              >
                תאריכים מדויקים
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "flexible"}
                className={mode === "flexible" ? "active" : ""}
                onClick={() => { setMode("flexible"); setConfirmed(false); }}
              >
                אני גמיש
              </button>
            </div>

            <div className="search-fields">
              <button type="button" className={`search-field${mode === "exact" && checkIn ? " filled" : ""}`} onClick={() => setMode("exact")}>
                <span>{mode === "exact" ? "הגעה" : "מתי"}</span>
                <strong>{mode === "exact" ? shortDate(checkIn) : compactMonthLabel(flexibleMonths[flexMonth])}</strong>
                <small>{mode === "exact" ? longDate(checkIn) : "החודש המועדף"}</small>
              </button>
              <button type="button" className={`search-field${mode === "exact" && checkOut ? " filled" : ""}`} onClick={() => setMode(mode)}>
                <span>{mode === "exact" ? "עזיבה" : "משך וגמישות"}</span>
                <strong>{mode === "exact" ? shortDate(checkOut) : selectedFlexStay.description}</strong>
                <small>{mode === "exact" ? longDate(checkOut) : flexibility === 0 ? "תאריכים מדויקים" : `עד ${flexibility} ימים לכל כיוון`}</small>
              </button>
              <div className="guest-field-wrap">
                <button
                  type="button"
                  className="search-field guest-field filled"
                  aria-expanded={guestPanelOpen}
                  onClick={() => setGuestPanelOpen((open) => !open)}
                >
                  <span>אורחים</span>
                  <strong>{guests.adults + guests.children} אורחים</strong>
                  <small>{guests.infants || guests.pets ? guestSummary(guests) : accessibleStay ? "נדרשת נגישות" : "עדכון הרכב"}</small>
                </button>

                {guestPanelOpen && (
                  <div className="guest-panel" role="dialog" aria-label="בחירת הרכב אורחים">
                    <div className="guest-panel-head">
                      <div>
                        <strong>מי יוצא לחופשה?</strong>
                        <small>אפשר לעדכן את ההרכב בכל שלב</small>
                      </div>
                      <button type="button" onClick={() => setGuestPanelOpen(false)} aria-label="סגירת בחירת האורחים">×</button>
                    </div>
                    <GuestRow label="מבוגרים" detail="מגיל 18" value={guests.adults} min={1} max={12} onChange={(value) => updateGuests("adults", value)} />
                    <GuestRow label="ילדים" detail="גיל 2 עד 17" value={guests.children} min={0} max={8} onChange={(value) => updateGuests("children", value)} />
                    <GuestRow label="תינוקות" detail="עד גיל שנתיים" value={guests.infants} min={0} max={5} onChange={(value) => updateGuests("infants", value)} />
                    <GuestRow label="חיות מחמד" detail="בהתאם למקום האירוח" value={guests.pets} min={0} max={3} onChange={(value) => updateGuests("pets", value)} />
                    <label className="accessibility-check">
                      <input type="checkbox" checked={accessibleStay} onChange={(event) => setAccessibleStay(event.target.checked)} />
                      <span>
                        <strong>נדרש מקום אירוח נגיש</strong>
                        <small>הבחירה תועבר לסינון המקומות</small>
                      </span>
                    </label>
                    <button type="button" className="guest-done" onClick={() => setGuestPanelOpen(false)}>סיום</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="picker-content" id="calendar-content">
          {mode === "exact" ? (
            <>
              <div className="calendar-heading-row">
                <div>
                  <span className="section-kicker">בחירה מדויקת</span>
                  <h2 className="section-title">בחרו הגעה ועזיבה</h2>
                </div>
                <div className="calendar-nav">
                  <button
                    type="button"
                    onClick={() => setMonthOffset((value) => Math.max(0, value - 1))}
                    disabled={monthOffset === 0}
                    aria-label="החודש הקודם"
                  >
                    →
                  </button>
                  <span>{monthLabel(firstMonth)}</span>
                  <button
                    type="button"
                    onClick={() => setMonthOffset((value) => Math.min(MAX_MONTH_OFFSET, value + 1))}
                    disabled={monthOffset === MAX_MONTH_OFFSET}
                    aria-label="החודש הבא"
                  >
                    ←
                  </button>
                </div>
              </div>

              <div className="quick-stays" aria-label="אפשרויות חופשה מהירות">
                <span>בחירה מהירה:</span>
                {QUICK_STAYS.map((stay) => (
                  <button type="button" key={stay.id} onClick={() => applyQuickStay(stay.id)}>{stay.label}</button>
                ))}
              </div>

              <div className="months-grid">
                <CalendarMonth
                  month={firstMonth}
                  checkIn={checkIn}
                  checkOut={checkOut}
                  hoverDate={hoverDate}
                  onDateClick={chooseDate}
                  onDateHover={setHoverDate}
                />
                <CalendarMonth
                  month={secondMonth}
                  checkIn={checkIn}
                  checkOut={checkOut}
                  hoverDate={hoverDate}
                  onDateClick={chooseDate}
                  onDateHover={setHoverDate}
                  secondary
                />
              </div>

              <div className="legend" aria-label="מקרא זמינות">
                <span><i className="dot open" />זמין</span>
                <span><i className="dot limited" />אפשרות אחרונה</span>
                <span><i className="dot busy" />לא זמין</span>
                <span className="demo-note">נתוני הזמינות להמחשה בלבד</span>
              </div>
            </>
          ) : (
            <div className="flexible-picker">
              <div className="flexible-heading">
                <span className="section-kicker">לא חייבים להחליט עכשיו</span>
                <h2>ספרו לנו מה בערך מתאים לכם</h2>
                <p>השילוב שבחרתם יאפשר להציג יותר מקומות וטווחים אפשריים.</p>
              </div>

              <div className="flex-group">
                <h3>כמה זמן תרצו להתארח?</h3>
                <div className="stay-options">
                  {FLEX_STAYS.map((stay) => (
                    <button
                      type="button"
                      key={stay.id}
                      className={flexStay === stay.id ? "selected" : ""}
                      onClick={() => { setFlexStay(stay.id); setConfirmed(false); }}
                    >
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
                    <button
                      type="button"
                      key={keyOf(month)}
                      className={flexMonth === index ? "selected" : ""}
                      onClick={() => { setFlexMonth(index); setConfirmed(false); }}
                    >
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
                    <button
                      type="button"
                      key={days}
                      className={flexibility === days ? "selected" : ""}
                      onClick={() => { setFlexibility(days); setConfirmed(false); }}
                    >
                      {days === 0 ? "ללא גמישות" : days === 1 ? "יום לכל כיוון" : `${days} ימים לכל כיוון`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        <footer className="booking-footer">
          <div className="selection-status" aria-live="polite">
            <span className={`status-mark${confirmed ? " confirmed" : ""}`}>{confirmed ? "✓" : mode === "exact" ? "1" : "≈"}</span>
            <div>
              <strong>{confirmed ? "הבחירה נשמרה להדגמה" : selectionTitle}</strong>
              <small>{confirmed ? "בגרסה המחוברת ייפתחו מכאן תוצאות החיפוש" : selectionDetail}</small>
            </div>
          </div>
          <div className="footer-actions">
            {mode === "exact" && (
              <button type="button" className="reset-button" onClick={resetSelection} disabled={!checkIn && !checkOut}>ניקוי</button>
            )}
            <button type="button" className="continue-button" disabled={!canContinue} onClick={confirmSelection}>
              הצגת מקומות מתאימים
              <span aria-hidden="true">←</span>
            </button>
          </div>
        </footer>
      </section>
    </main>
  );
}
