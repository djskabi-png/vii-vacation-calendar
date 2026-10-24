const labels: Record<string, string> = {
  type: "סוג מקום", eventType: "סוג אירוע", guests: "מספר אורחים", bedrooms: "חדרי שינה",
  noise: "ללא הגבלת רעש", accessible: "נגישות", online: "הזמנה אונליין", hours: "משך שהייה",
  maxPrice: "מחיר מרבי", experience: "סוג חוויה", package: "חבילה", features: "מאפיינים",
};

const values: Record<string, string> = {
  events: "מתאים לאירועים", "heated-pool": "בריכה מחוממת", "covered-heated-pool": "בריכה מחוממת ומקורה",
  barbecue: "עמדת ברביקיו", parties: "מתאים למסיבות", families: "מתאים למשפחות", bachelorette: "מסיבת רווקות",
  bachelor: "מסיבת רווקים", couples: "מתאים לזוגות", youth: "מתאים לצעירים", birthdays: "ימי הולדת",
  "team-building": "ימי גיבוש", religious: "מתאים לשומרי מסורת", proposals: "הצעות נישואין", "fun-days": "ימי כיף",
  accessible: "נגיש לנכים", "outdoor-sound": "מערכת שמע חיצונית", weddings: "חתונות", "private-pool": "בריכה פרטית",
  groups: "מתאים לקבוצות", "children-pool": "בריכת ילדים", wifi: "אינטרנט אלחוטי", "fenced-pool": "בריכה מגודרת",
  "couples-only": "לזוגות בלבד", pool: "בריכה", spa: "ספא", massage: "עיסוי",
};

export function searchFilterLabel(key: string) {
  return labels[key] || key;
}

export function searchFilterValueLabel(key: string, value: string | number | boolean) {
  if (typeof value === "boolean") {
    if (!value) return "לא";
    if (key === "accessible") return "נגיש לנכים";
    if (key === "online") return "ניתן להזמין אונליין";
    if (key === "noise") return "ללא הגבלת רעש";
    return "כן";
  }
  if (typeof value === "number") return key === "maxPrice" ? `${value.toLocaleString("he-IL")} ₪` : value.toLocaleString("he-IL");
  return value.split(",").map((entry) => values[entry.trim()] || entry.trim()).filter(Boolean).join(" · ");
}

export function searchFilterSummary(filters: Record<string, string | number | boolean>) {
  return Object.entries(filters).map(([key, value]) => `${searchFilterLabel(key)}: ${searchFilterValueLabel(key, value)}`);
}
