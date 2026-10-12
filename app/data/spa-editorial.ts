import { spaPlusAudience } from "./spa-audience.ts";
import { spaViiCopy } from "./spa-vii-copy.ts";
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
  return spaViiCopy(site.id).cardSummary;
}

export function spaEditorialTitle(site: SpaPlusSite) {
  return site.title;
}

export function spaEditorialDescription(site: SpaPlusSite) {
  const audiences = audienceText(site);
  const count = site.packages.length;
  const location = site.city ? ` ב${site.city}` : "";
  const details = count
    ? `${count} ${count === 1 ? "חבילת ספא" : "חבילות ספא"}${audiences ? ` ${audiences}` : ""}. מחירים; זמינות סופית בהזמנה.`
    : "פרטי המקום ושעות הפעילות באתר וי.";
  const full = `${site.title}${location}: ${details}`;
  return full.length <= 160 || !site.city ? full : `${site.title}: ${details}`;
}
