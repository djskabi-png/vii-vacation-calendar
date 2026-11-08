"use client";

import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Building2, ExternalLink, Sparkles } from "lucide-react";
import { adminNavigationGroups as groups } from "./admin-navigation.ts";
import styles from "./admin.module.css";
import { adminRouteAllowed, type AdminAccess } from "../lib/admin-permissions.ts";



export default function AdminNav({ access }: { access: AdminAccess }) {
  const pathname = usePathname();
  const popularMode = Boolean(useSearchParams().get("popularWorld"));
  return <aside className={styles.navigation} dir="rtl">
    <Link href="/admin" prefetch={false} className={styles.brand}><span className={styles.mark}><Sparkles size={18} aria-hidden="true" /></span><span><strong>V Control</strong><small>מערכת הניהול</small></span></Link>
    <nav aria-label="ניווט מערכת הניהול">{groups.map((group) => ({ ...group, links: group.links.filter((link) => adminRouteAllowed(access, link.href.split("?")[0])) })).filter((group) => group.links.length).map((group) => <section key={group.label}><h2>{group.label}</h2>{group.links.map(({ href, label, icon: Icon }) => {
      const active = href.includes("?popularWorld=") ? pathname === "/admin/content-studio" && popularMode : href === "/admin/content-studio" ? pathname === href && !popularMode : href === "/admin" ? pathname === href : pathname.startsWith(href);
      return <Link key={href} href={href} prefetch={false} aria-current={active ? "page" : undefined}><Icon size={18} aria-hidden="true" /><span>{label}</span></Link>;
    })}</section>)}</nav>
    <div className={styles.navFooter}><div><Building2 size={16} aria-hidden="true" /><span><strong>V</strong><small>סביבת ייצור</small></span></div><Link href="/" prefetch={false}>פתיחת האתר <ExternalLink size={14} aria-hidden="true" /></Link></div>
  </aside>;
}
