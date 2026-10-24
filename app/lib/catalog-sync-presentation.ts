import type { CatalogSyncDiagnostics } from "./supplier-catalog-diagnostics.ts";
import type { SupplierCatalogWorld } from "./supplier-catalog-store.ts";

const childLabels: Record<SupplierCatalogWorld, { plural: string; singular: string }> = {
  vacations: { plural: "יחידות אירוח", singular: "יחידת אירוח" },
  events: { plural: "חללי אירוח", singular: "חלל אירוח" },
  rooms: { plural: "חדרים", singular: "חדר" },
  spa: { plural: "חבילות ספא", singular: "חבילת ספא" },
};

const placeLabels: Record<SupplierCatalogWorld, { plural: string; singular: string }> = {
  vacations: { plural: "מקומות נופש", singular: "מקום נופש" },
  events: { plural: "מקומות לאירועים", singular: "מקום לאירועים" },
  rooms: { plural: "מתחמי חדרים", singular: "מתחם חדרים" },
  spa: { plural: "בתי ספא", singular: "בית ספא" },
};

export function catalogDiagnosticLabels(world: SupplierCatalogWorld) {
  return { children: childLabels[world], places: placeLabels[world] };
}

export function catalogRunStatusLabel(status: string | null | undefined) {
  return ({ requested: "ממתין", running: "מתבצע עכשיו", accepted: "פורסם", rejected: "נעצר לבדיקה",
    failed: "נכשל", skipped: "דולג" } as Record<string, string>)[status || ""] || status || "אין עדיין";
}

export function catalogRunSourceLabel(source: string) {
  return source === "manual" ? "הפעלה ידנית" : source === "scheduled" ? "עדכון מתוזמן" : source === "retry" ? "ניסיון אוטומטי חוזר" : source;
}

function percentage(removed: number, before: number) {
  if (!before) return "0";
  return new Intl.NumberFormat("he-IL", { maximumFractionDigits: 1 }).format((removed / before) * 100);
}

export function catalogRunExplanation(world: SupplierCatalogWorld, errorCode: string | null | undefined,
  diagnostics?: CatalogSyncDiagnostics) {
  const labels = catalogDiagnosticLabels(world);
  if (errorCode === "catalog_removal_requires_review") {
    const removedPlaces = diagnostics?.removedCount || 0;
    const removedChildren = diagnostics?.units?.removedTotal || 0;
    const placePart = removedPlaces
      ? `${removedPlaces} ${labels.places.plural} (${percentage(removedPlaces, diagnostics?.before || 0)}%)`
      : "ללא הסרת מקומות";
    const childPart = removedChildren
      ? `${removedChildren} ${labels.children.plural} (${percentage(removedChildren, diagnostics?.units?.before || 0)}%)`
      : `ללא הסרת ${labels.children.plural}`;
    return `הספק החזיר שינוי חריג: ${placePart}, ${childPart}. העדכון נעצר אוטומטית והקטלוג הקודם נשמר.`;
  }
  if (errorCode === "catalog_media_requires_review") {
    return "הספק החזיר ירידה חריגה בתמונות של קטלוג הספא. העדכון נעצר אוטומטית והקטלוג הקודם נשמר.";
  }
  if (errorCode === "catalog_editorial_requires_review") {
    return "נמצאו שינויים בתוכן הספא שדורשים בדיקה לפני פרסום. הקטלוג הקודם נשמר.";
  }
  if (errorCode === "invalid_spa_response") {
    return "ספק הספא החזיר תשובה שלא ניתן לקרוא. לא בוצע שינוי בקטלוג.";
  }
  if (errorCode === "spa_redirect_not_allowed") {
    return "ספק הספא הפנה לכתובת אחרת ולכן המשיכה נעצרה מטעמי בטיחות. לא בוצע שינוי בקטלוג.";
  }
  if (errorCode === "missing_spa_key" || errorCode === "spa_not_authorized") {
    return "החיבור המאובטח לספק הספא אינו מורשה כרגע. לא בוצע שינוי בקטלוג.";
  }
  if (errorCode === "spa_transport_error" || errorCode === "spa_provider_error") {
    return "לא ניתן היה לקבל נתונים מספק הספא. לא בוצע שינוי בקטלוג.";
  }
  const failure = diagnostics?.failure;
  if (failure?.stage === "source_fetch") {
    if (failure.category === "authorization") return "החיבור המאובטח לספק אינו מורשה. הקטלוג הקודם נשמר ויש לבדוק את מפתח החיבור.";
    if (failure.category === "invalid_response") return "הספק החזיר מידע במבנה שאינו תקין. הקטלוג הקודם נשמר ולא פורסם מידע חלקי.";
    if (failure.category === "transport" || failure.category === "provider") return "הקשר עם הספק נכשל לפני שהתקבל קטלוג מלא. הקטלוג הקודם נשמר וניתן לנסות שוב אוטומטית.";
    if (failure.category === "resource_or_runtime") return "משיכת הספק הייתה גדולה מדי לריצה אחת ונעצרה לפני יצירת קטלוג מלא. הקטלוג הקודם נשמר.";
  }
  if (failure?.stage === "candidate_stage" || failure?.stage === "catalog_read" || failure?.stage === "publish") {
    const progress = failure.total !== undefined ? ` (${failure.completed || 0} מתוך ${failure.total})` : "";
    return `שמירת הקטלוג נקטעה בשלב מסד הנתונים${progress}. הדור הקודם נשמר ולא פורסם דור חלקי.`;
  }
  if (failure) return "המשיכה נעצרה לפני פרסום. הקטלוג הקודם נשמר ופרטי השלב מופיעים באבחון.";
  return "המשיכה לא אושרה והקטלוג הקודם נשמר. בריצה הישנה הזאת לא נשמר אבחון מפורט.";
}
