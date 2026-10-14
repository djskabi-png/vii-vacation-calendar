"use client";

import { usePathname } from "next/navigation";
import { BarChart3, Building2, CalendarSync, ExternalLink, FileSearch, Gauge, ListChecks, MessageCircle, Route, Search, Sparkles, Star, TrendingUp } from "lucide-react";
import styles from "./admin.module.css";

const groups = [
  { label: "מרכז שליטה", links: [
    { href: "/admin", label: "תמונת מצב", icon: Gauge },
    { href: "/admin/growth", label: "מרכז קידום", icon: Sparkles },
    { href: "/admin/search-pages", label: "מרכז עמודי חיפוש", icon: FileSearch },
    { href: "/admin/business-performance", label: "ביצועי עסקים", icon: BarChart3 },
  ] },
  { label: "תוכן וגילוי", links: [
    { href: "/admin/search-analytics", label: "מודיעין חיפושים", icon: Search },
    { href: "/admin/content-queue", label: "תור אישורים", icon: ListChecks },
    { href: "/admin/discovery-promotions", label: "קידום מקומות", icon: TrendingUp },
    { href: "/admin/redirects", label: "כתובות והפניות", icon: Route },
  ] },
  { label: "תפעול", links: [
    { href: "/admin/catalog-sync", label: "קטלוגים וספקים", icon: CalendarSync },
    { href: "/admin/operations", label: "הזמנות וחוות דעת", icon: Star },
    { href: "/admin/whatsapp-leads", label: "פניות וואטסאפ", icon: MessageCircle },
  ] },
];

export default function AdminNav() {
  const pathname = usePathname();
  return <aside className={styles.navigation} dir="rtl">
    <a href="/admin" className={styles.brand}><span className={styles.mark}><Sparkles size={18} aria-hidden="true" /></span><span><strong>VII Control</strong><small>מערכת הניהול</small></span></a>
    <nav aria-label="ניווט מערכת הניהול">{groups.map((group) => <section key={group.label}><h2>{group.label}</h2>{group.links.map(({ href, label, icon: Icon }) => {
      const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
      return <a key={href} href={href} aria-current={active ? "page" : undefined}><Icon size={18} aria-hidden="true" /><span>{label}</span></a>;
    })}</section>)}</nav>
    <div className={styles.navFooter}><div><Building2 size={16} aria-hidden="true" /><span><strong>VII</strong><small>סביבת ייצור</small></span></div><a href="/">פתיחת האתר <ExternalLink size={14} aria-hidden="true" /></a></div>
  </aside>;
}
