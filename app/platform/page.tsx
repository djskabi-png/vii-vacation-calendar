import type { Metadata } from "next";
import { PlatformExplorer } from "./platform-explorer";
import styles from "./platform.module.css";

export const metadata: Metadata = {
  title: "VII Platform | מפת המערכת",
  description: "מפת ארכיטקטורת היעד האינטראקטיבית של פלטפורמת VII.",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  alternates: { canonical: "/platform" },
  openGraph: {
    title: "VII Platform | One platform. Many worlds.",
    description: "כך VII מחברת ספקי מידע, עולמות תוכן ומוצרי קצה למערכת אחת.",
    url: "/platform",
    images: [{ url: "/platform-architecture.png", width: 1672, height: 941, alt: "מפת ארכיטקטורת היעד של פלטפורמת VII" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "VII Platform | One platform. Many worlds.",
    description: "מפת ארכיטקטורת היעד האינטראקטיבית של VII.",
    images: ["/platform-architecture.png"],
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
