import type { Metadata } from "next";
import { PlatformExplorer } from "./platform-explorer";
import styles from "./platform.module.css";

export const metadata: Metadata = {
  title: "V Platform | מפת המערכת",
  description: "הדמיית ארכיטקטורה אינטראקטיבית ולחיצה של פלטפורמת V, הספקים, ליבת הנתונים ומוצרי הקצה.",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  alternates: { canonical: "/platform" },
  openGraph: {
    title: "V Platform | One platform. Many worlds.",
    description: "הפעילו תרחישים ולחצו על כל שכבה כדי לראות כיצד V מחברת ספקים, נתונים, עולמות ומוצרי קצה.",
    url: "/platform",
    images: [{ url: "/platform-architecture-overview.png", width: 1672, height: 941, alt: "מפת ארכיטקטורת היעד האינטראקטיבית של פלטפורמת V" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "V Platform | One platform. Many worlds.",
    description: "הדמיית הארכיטקטורה הלחיצה של V.",
    images: ["/platform-architecture-overview.png"],
  },
};

export default function PlatformPage() {
  return (
    <main id="main-content" className={styles.page} dir="rtl">
      <a className={styles.skipLink} href="#platform-map">דילוג למפת המערכת</a>
      <PlatformExplorer />
    </main>
  );
}
