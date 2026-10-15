import { ArrowLeft, ChevronDown, FileCode2 } from "lucide-react";
import styles from "./growth.module.css";

export type SitemapFile = { page: number; url: string; urls: number; bytes: number; imageReferences: number; alternateLinks: number; languages: Array<{ label: string; count: number }>; contents: Array<{ label: string; count: number }>; samples: string[]; limits: { viiUrlPercent: number; googleUrlPercent: number; googleBytePercent: number }; status: "healthy" | "error" };
export type SitemapSection = { section: string; urls: number; files: number; images: number; fileDetails: SitemapFile[] };
export type SitemapReport = { healthy: boolean; totalUrls: number; totalFiles: number; languages: string[]; limits: { viiUrlsPerFile: number; googleUrlsPerFile: number; googleBytesPerFile: number }; sections: SitemapSection[]; generatedAt: string };

const sectionMeta: Record<string, { label: string; description: string }> = {
  core: { label: "עמודי ליבה", description: "דף הבית, מידע, הצטרפות, נגישות ועמודים משפטיים" },
  vacations: { label: "נופש", description: "מקומות נופש, חיפוש ודפי נחיתה לפי אזור וסוג אירוח" },
  events: { label: "אירועים", description: "מקומות אירוח לאירועים ודפי חיפוש אזוריים" },
  spas: { label: "ספא", description: "בתי ספא ודפי נחיתה וחיפוש מאושרים" },
  hourly: { label: "חדרים לפי שעה", description: "מקומות ודפי חיפוש אזוריים של ROOMS VIP" },
  discovery: { label: "גילוי ותוכן", description: "אטרקציות, מסלולים, מדריכים וכתבות מגזין" },
  "search-pages": { label: "עמודי חיפוש שפורסמו", description: "עמודים שנוצרו מביקוש אמיתי, נערכו ואושרו לפרסום" },
};

const contentLabels: Record<string, string> = {
  home: "דף הבית", join: "הצטרפות ל־VII", "legal-accessibility": "משפטי ונגישות", "information-services": "מידע ושירותים",
  "vacation-search": "חיפוש נופש", "place-pages": "עמודי מקום", "region-type-landings": "דפי נחיתה לפי אזור או סוג",
  "search-region-pages": "חיפוש ודפי אזור", "events-world": "עמוד עולם האירועים", "spa-place-pages": "עמודי בית ספא",
  "spa-world": "עמוד עולם הספא", "landing-search-pages": "דפי נחיתה וחיפוש", "hourly-world": "עמוד עולם החדרים",
  "regional-search-pages": "דפי חיפוש אזוריים", "guides-articles": "כתבות ומדריכים", trails: "מסלולי טיול",
  "attractions-providers": "אטרקציות וספקים", "world-content-pages": "עמודי עולם ותוכן", "published-demand-pages": "עמודי ביקוש שפורסמו",
};

export function SitemapDetails({ report }: { report: SitemapReport }) {
  return <section className={styles.sitemaps} aria-labelledby="sitemap-details-title">
    <header><div><h2 id="sitemap-details-title">מה יש בכל קובץ מפת אתר</h2><p>הנתונים מחושבים מאותו מקור שמייצר את קובצי ה־XML. אפשר לפתוח כל משפחה ולראות בדיוק מה Google מקבל.</p></div><div className={styles.limitNote}><strong>{report.limits.viiUrlsPerFile.toLocaleString("he-IL")}</strong><span>כתובות לכל קובץ ב־VII</span><small>Google מאפשר עד {report.limits.googleUrlsPerFile.toLocaleString("he-IL")} כתובות או {(report.limits.googleBytesPerFile / 1024 / 1024).toLocaleString("he-IL")}MB</small></div></header>
    <div className={styles.sitemapGrid}>{report.sections.map((section, sectionIndex) => { const meta = sectionMeta[section.section] || { label: section.section, description: "משפחת מפת אתר" }; return <details key={section.section} open={sectionIndex === 1} className={styles.sitemapFamily}>
      <summary><span className={styles.familyIcon}><FileCode2 size={18} /></span><div><strong>{meta.label}</strong><small>{meta.description}</small></div><span className={styles.familyCount}>{section.urls.toLocaleString("he-IL")} כתובות · {section.files.toLocaleString("he-IL")} קבצים</span><ChevronDown size={17} /></summary>
      <div className={styles.sitemapFiles}>{section.fileDetails.map((file) => <article key={file.url}>
        <header><div><span data-status={file.status}>{file.status === "healthy" ? "תקין" : "חריגה"}</span><h3>קובץ {file.page}</h3></div><a href={file.url} target="_blank" rel="noreferrer">פתיחת XML <ArrowLeft size={14} /></a></header>
        <div className={styles.fileMetrics}><div><small>כתובות</small><strong>{file.urls.toLocaleString("he-IL")}</strong><span>{file.limits.googleUrlPercent}% ממגבלת Google</span></div><div><small>גודל לא דחוס</small><strong>{formatBytes(file.bytes)}</strong><span>{file.limits.googleBytePercent}% ממגבלת Google</span></div><div><small>תמונות</small><strong>{file.imageReferences.toLocaleString("he-IL")}</strong><span>הפניות image sitemap</span></div><div><small>חלופות שפה</small><strong>{file.alternateLinks.toLocaleString("he-IL")}</strong><span>קישורי hreflang</span></div></div>
        <div className={styles.fileBody}><div><h4>מה הקובץ מכיל</h4><ul>{file.contents.map((item) => <li key={item.label}><span>{contentLabels[item.label] || item.label}</span><b>{item.count.toLocaleString("he-IL")}</b></li>)}</ul></div><div><h4>חלוקה לשפות</h4><ul>{file.languages.map((item) => <li key={item.label}><span>{languageLabel(item.label)}</span><b>{item.count.toLocaleString("he-IL")}</b></li>)}</ul></div></div>
        <details className={styles.samples}><summary>דוגמאות לכתובות</summary><ul>{file.samples.map((url) => <li key={url}><a href={url} target="_blank" rel="noreferrer" dir="ltr">{url}</a></li>)}</ul></details>
      </article>)}</div>
    </details>; })}</div>
  </section>;
}

function formatBytes(bytes: number) { return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toLocaleString("he-IL", { maximumFractionDigits: 2 })}MB` : `${Math.ceil(bytes / 1024).toLocaleString("he-IL")}KB`; }
function languageLabel(locale: string) { return ({ "he-IL": "עברית", en: "אנגלית", ru: "רוסית", fr: "צרפתית" } as Record<string, string>)[locale] || locale; }
