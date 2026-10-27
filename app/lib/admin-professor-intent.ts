export type ProfessorWorld = "vacations" | "events" | "rooms" | "spa";
export type ProfessorMetric = "impressions" | "pageViews" | "phone" | "whatsapp" | "viiBookings" | "bizCalls" | "bizWhatsapp" | "bizOrders" | "bizRevenue";
export type ProfessorPlace = { placeId: string; name: string; world: ProfessorWorld; siteID: number | null };
export type ProfessorRange = { from: string; till: string; label: string };
export type ProfessorIntent = {
  range: ProfessorRange;
  compareRange: ProfessorRange | null;
  place: ProfessorPlace | null;
  world: ProfessorWorld | null;
  metrics: ProfessorMetric[];
  explicitMetrics: boolean;
  ranking: boolean;
  unsupportedReason: string | null;
};

const WORLD_TERMS: Array<[ProfessorWorld, RegExp]> = [
  ["vacations", /(?:כל\s+)?(?:הנופש|נופשים|וילות|צימרים)/],
  ["events", /(?:כל\s+)?(?:האירועים|אירועים|מתחמי\s+אירוח)/],
  ["rooms", /(?:כל\s+)?(?:החדרים|חדרים\s+לפי\s+שעה|לפי\s+שעה)/],
  ["spa", /(?:כל\s+)?(?:הספא|ספא)/],
];

export const cleanProfessorText = (value: string) => value.normalize("NFKC").replace(/[\u0591-\u05C7]/g, "")
  .replace(/[״”]/g, '"').replace(/[׳’]/g, "'").replace(/[^\p{L}\p{N}]+/gu, " ").trim().toLowerCase();

const day = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
const dateAtNoon = (value: string) => new Date(`${value}T12:00:00Z`);
const shift = (value: string, delta: number) => { const date = dateAtNoon(value); date.setUTCDate(date.getUTCDate() + delta); return day(date); };
const validDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && day(dateAtNoon(value)) === value;
const displayRange = (from: string, till: string) => from === till ? from : `${from} עד ${till}`;

function explicitRange(question: string): ProfessorRange | null {
  const iso = question.match(/(?:מ(?:תאריך)?\s*)?(\d{4}-\d{2}-\d{2})\s*(?:עד|ועד|\-|–)\s*(?:ל(?:תאריך)?\s*)?(\d{4}-\d{2}-\d{2})/);
  const local = question.match(/(?:מ(?:תאריך)?\s*)?(\d{1,2})[/.](\d{1,2})[/.](\d{4})\s*(?:עד|ועד|\-|–)\s*(\d{1,2})[/.](\d{1,2})[/.](\d{4})/);
  const from = iso?.[1] || (local ? `${local[3]}-${local[2].padStart(2, "0")}-${local[1].padStart(2, "0")}` : "");
  const till = iso?.[2] || (local ? `${local[6]}-${local[5].padStart(2, "0")}-${local[4].padStart(2, "0")}` : "");
  if (!validDay(from) || !validDay(till) || from > till) return null;
  return { from, till, label: displayRange(from, till) };
}

export function professorRange(question: string, now = new Date()): ProfessorRange {
  const explicit = explicitRange(question); if (explicit) return explicit;
  const today = day(now); const current = dateAtNoon(today);
  if (/אתמול/.test(question)) { const value = shift(today, -1); return { from: value, till: value, label: "אתמול" }; }
  if (/היום/.test(question)) return { from: today, till: today, label: "היום" };
  if (/שבוע\s+שעבר/.test(question)) { const weekday = current.getUTCDay(); const thisSunday = shift(today, -weekday); return { from: shift(thisSunday, -7), till: shift(thisSunday, -1), label: "השבוע הקודם" }; }
  if (/השבוע/.test(question)) return { from: shift(today, -current.getUTCDay()), till: today, label: "השבוע הנוכחי עד היום" };
  if (/חודש\s+שעבר|החודש\s+הקודם/.test(question)) { const start = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - 1, 1, 12)); const end = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), 0, 12)); return { from: day(start), till: day(end), label: "החודש הקודם" }; }
  if (/השנה/.test(question)) return { from: `${today.slice(0, 4)}-01-01`, till: today, label: "השנה עד היום" };
  const recent = question.match(/(?:אחרונים|האחרונים)\s*(\d{1,3})\s*(?:יום|ימים)/) || question.match(/(\d{1,3})\s*(?:ה)?(?:יום|ימים)\s*(?:אחרונים|האחרונים)/);
  if (recent) { const count = Math.min(365, Math.max(1, Number(recent[1]))); return { from: shift(today, -count + 1), till: today, label: `${count} הימים האחרונים` }; }
  return { from: `${today.slice(0, 7)}-01`, till: today, label: "החודש הנוכחי עד היום" };
}

export function previousProfessorRange(range: ProfessorRange): ProfessorRange {
  const days = Math.round((Date.parse(`${range.till}T00:00:00Z`) - Date.parse(`${range.from}T00:00:00Z`)) / 86_400_000) + 1;
  const till = shift(range.from, -1); const from = shift(till, -days + 1);
  return { from, till, label: `התקופה הקודמת, ${displayRange(from, till)}` };
}

function requestedMetrics(question: string): { metrics: ProfessorMetric[]; explicit: boolean } {
  const metrics: ProfessorMetric[] = [];
  const add = (...items: ProfessorMetric[]) => items.forEach((item) => { if (!metrics.includes(item)) metrics.push(item); });
  if (/חשיפות?/.test(question)) add("impressions");
  if (/כניסות?|צפיות?|עמודי?\s+עסק/.test(question)) add("pageViews");
  if (/טלפונים?|לחיצ(?:ה|ות)\s+(?:על\s+)?(?:מספר|טלפון)|גילוי\s+מספר/.test(question)) add("phone", "bizCalls");
  if (/וואטסאפ|whatsapp|הודעות?/.test(question)) add("whatsapp", "bizWhatsapp");
  if (/בקשות?\s+הזמנה|הזמנות?\s+(?:מ|של)[־-]?v\b/.test(question)) add("viiBookings");
  if (/שיחות?|מסקיו/.test(question)) add("bizCalls");
  if (/הזמנ(?:ה|ות)\s*(?:מ|של)?\s*biz|הזמנ(?:ה|ות)\s*(?:מ|של)?\s*ביז|הכנסות?|מחזור|סכום/.test(question)) add("bizOrders", "bizRevenue");
  if (/מכל\s+כמה|יחס\s+המרה|אחוז\s+המרה|המרות?/.test(question)) {
    if (/שיחות?|טלפונים?|מסקיו/.test(question)) add("bizCalls");
    if (/וואטסאפ|whatsapp|הודעות?/.test(question)) add("bizWhatsapp");
    add("bizOrders");
  }
  return { metrics: metrics.length ? metrics : ["phone", "whatsapp", "viiBookings", "bizCalls", "bizWhatsapp", "bizOrders", "bizRevenue"], explicit: metrics.length > 0 };
}

function tokens(value: string) { return cleanProfessorText(value).split(" ").filter((part) => part.length > 1); }
function editDistance(a: string, b: string) {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let row = 1; row <= a.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= b.length; column += 1) current[column] = Math.min(
      current[column - 1] + 1,
      previous[column] + 1,
      previous[column - 1] + (a[row - 1] === b[column - 1] ? 0 : 1),
    );
    previous.splice(0, previous.length, ...current);
  }
  return previous[b.length];
}
function tokenMatches(queryToken: string, nameToken: string) {
  if (queryToken === nameToken) return true;
  if (nameToken.length < 4 || Math.abs(queryToken.length - nameToken.length) > 1) return false;
  return editDistance(queryToken, nameToken) <= 1;
}
function placeScore(query: string, place: ProfessorPlace) {
  const name = cleanProfessorText(place.name); if (!name) return 0;
  if (query.includes(name)) return 1;
  const queryTokens = new Set(tokens(query)); const nameTokens = tokens(name);
  if (!nameTokens.length) return 0;
  const matched = nameTokens.filter((token) => [...queryTokens].some((queryToken) => tokenMatches(queryToken, token))).length;
  return matched / nameTokens.length;
}

export function matchProfessorPlace(question: string, places: ProfessorPlace[]) {
  const query = cleanProfessorText(question);
  const scored = places.map((place) => ({ place, score: placeScore(query, place) })).filter((item) => item.score >= .67)
    .sort((a, b) => b.score - a.score || b.place.name.length - a.place.name.length);
  if (!scored.length) return { place: null, ambiguous: [] as ProfessorPlace[] };
  const best = scored[0]; const tied = scored.filter((item) => item.score === best.score && cleanProfessorText(item.place.name) !== cleanProfessorText(best.place.name));
  return tied.length ? { place: null, ambiguous: [best.place, ...tied.map((item) => item.place)].slice(0, 5) } : { place: best.place, ambiguous: [] as ProfessorPlace[] };
}

export function parseProfessorIntent(question: string, places: ProfessorPlace[], now = new Date()): ProfessorIntent & { ambiguous: ProfessorPlace[] } {
  const normalized = cleanProfessorText(question); const range = professorRange(question, now);
  const placeMatch = matchProfessorPlace(normalized, places);
  const requested = requestedMetrics(normalized);
  const world = placeMatch.place?.world || WORLD_TERMS.find(([, pattern]) => pattern.test(normalized))?.[0] || null;
  const comparison = /לעומת|השוו|בהשוואה|מול\s+(?:התקופה|החודש|השבוע)|הבדל|שינוי|עלה|ירד/.test(normalized);
  const asksCause = /למה|מה\s+הסיבה|מדוע/.test(normalized);
  const explicitlyNamesBusiness = /(?:לעסק|עבור\s+עסק|של\s+העסק)\s+\S+/.test(normalized);
  const missingBusiness = explicitlyNamesBusiness && !placeMatch.place && !placeMatch.ambiguous.length;
  return {
    range,
    compareRange: comparison ? previousProfessorRange(range) : null,
    place: placeMatch.place,
    world,
    metrics: requested.metrics,
    explicitMetrics: requested.explicit,
    ranking: /מי\s+(?:הכי|מוביל)|הכי\s+(?:הרבה|גבוה)|עסקים?\s+מובילים|טופ\s*\d*/.test(normalized),
    unsupportedReason: asksCause
      ? "אני יכול למדוד שינוי, אבל הנתונים אינם מוכיחים את הסיבה. אפשר לשאול מה עלה או ירד לעומת התקופה הקודמת."
      : missingBusiness ? "לא מצאתי עסק שמתאים לשם שכתבת. כתוב את שם העסק כפי שהוא מופיע במערכת." : null,
    ambiguous: placeMatch.ambiguous,
  };
}

export function professorNeedsInventory(question: string) {
  const normalized = cleanProfessorText(question);
  return /מי\s+(?:הכי|מוביל)|הכי\s+(?:הרבה|גבוה)|עסקים?\s+מובילים|טופ\s*\d*/u.test(normalized)
    || /(?:לעסק|עבור\s+עסק)\s+/u.test(normalized)
    || /(?:^|\s)ל(?!כולם(?:\s|$)|כל(?:\s|$)|מי(?:\s|$)|מה(?:\s|$)|תקופה(?:\s|$)|חודש(?:\s|$)|שבוע(?:\s|$)|שנה(?:\s|$))[\p{L}]{3,}/u.test(normalized)
    || /של\s+(?!החודש(?:\s|$)|השבוע(?:\s|$)|השנה(?:\s|$)|כל(?:\s|$)|העסק(?:\s|$))[\p{L}]{2,}/u.test(normalized);
}
