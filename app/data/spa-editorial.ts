import { spaPlusAudience } from "./spa-audience.ts";
import type { SpaPlusSite } from "./spaplus";

function audienceText(site: SpaPlusSite) {
  const audiences = new Set(site.packages.map(spaPlusAudience));
  const labels = [
    audiences.has("זוג") ? "לזוגות" : "",
    audiences.has("יחיד") ? "ליחידים" : "",
    audiences.has("קבוצה") ? "לקבוצות" : "",
  ].filter(Boolean);
  return labels.length ? labels.join(", ") : "";
}

export function spaEditorialSummary(site: SpaPlusSite) {
  const location = site.city ? ` ב${site.city}` : "";
  const count = site.packages.length;
  const audiences = audienceText(site);
  const packageText = count
    ? `${count} ${count === 1 ? "חבילת ספא" : "חבילות ספא"}${audiences ? ` ${audiences}` : ""}`
    : "פרטי ספא";
  return `${site.title}${location} מופיע בקטלוג וי עם ${packageText}. ${count ? "כאן אפשר לעיין בחבילות ובמחירים שנמסרו ולבדוק זמינות בתהליך ההזמנה." : "כאן אפשר לעיין בפרטי המקום ובשעות הפעילות שנמסרו."}`;
}

export function spaEditorialTitle(site: SpaPlusSite) {
  return site.title;
}

export function spaEditorialDescription(site: SpaPlusSite) {
  const audiences = audienceText(site);
  const count = site.packages.length;
  const location = site.city ? ` ב${site.city}` : "";
  const details = count
    ? `${count} ${count === 1 ? "חבילת ספא" : "חבילות ספא"}${audiences ? ` ${audiences}` : ""}. מחירים ובדיקת זמינות באתר וי.`
    : "פרטי המקום ושעות הפעילות באתר וי.";
  const full = `${site.title}${location}: ${details}`;
  return full.length <= 160 || !site.city ? full : `${site.title}: ${details}`;
}
