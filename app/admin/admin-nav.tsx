"use client";

import { usePathname } from "next/navigation";
import { ExternalLink } from "lucide-react";
import styles from "./admin.module.css";

const links = [
  { href: "/admin", label: "תמונת מצב" },
  { href: "/admin/catalog-sync", label: "קטלוגים" },
  { href: "/admin/search-analytics", label: "חיפושים" },
  { href: "/admin/business-performance", label: "ביצועי עסקים" },
  { href: "/admin/content-queue", label: "תור אישורים" },
  { href: "/admin/search-pages", label: "עמודי חיפוש" },
  { href: "/admin/redirects", label: "הפניות 301" },
  { href: "/admin/operations", label: "הזמנות וחוות דעת" },
  { href: "/admin/whatsapp-leads", label: "פניות וואטסאפ" },
  { href: "/admin/discovery-promotions", label: "קידום מקומות" },
];

export default function AdminNav() {
  const pathname = usePathname();
  return <div className={styles.navigation} dir="rtl">
    <div className={styles.navigationInner}>
      <a href="/admin" className={styles.brand}><span className={styles.mark}>VII</span><span><strong>מרכז הניהול</strong><small>וי פור ויקיישן</small></span></a>
      <nav aria-label="ניווט מערכת הניהול">{links.map((entry) =>
        <a key={entry.href} href={entry.href} aria-current={pathname === entry.href ? "page" : undefined}>{entry.label}</a>)}</nav>
      <a href="/" className={styles.siteLink}>לאתר <ExternalLink size={15} aria-hidden="true" /></a>
    </div>
  </div>;
}

