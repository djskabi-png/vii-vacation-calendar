import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { resolveAdminAccess } from "../lib/admin-grants.ts";
import { adminLanding, adminRouteAllowed } from "../lib/admin-permissions.ts";
import { readAdminSession } from "../lib/google-auth.ts";
import AdminCommandBar from "./admin-command-bar";
import AdminNav from "./admin-nav";
import AdminAccessProvider from "./admin-access-context.tsx";
import styles from "./admin.module.css";

export const metadata: Metadata = { robots: { index: false, follow: false } };

function requestFromHeaders(requestHeaders: Headers, pathname: string) {
  const forwarded = new Headers();
  const cookie = requestHeaders.get("cookie");
  if (cookie) forwarded.set("cookie", cookie);
  return new Request(new URL(pathname, "https://vii.spaplus.co"), { headers: forwarded });
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers();
  const pathname = requestHeaders.get("x-vii-pathname") || "/admin";
  if (pathname === "/admin/login") return <>{children}</>;
  const request = requestFromHeaders(requestHeaders, pathname);
  const session = await readAdminSession(request).catch(() => null);
  if (!session) redirect(`/admin/login?returnTo=${encodeURIComponent(pathname)}`);
  const access = await resolveAdminAccess(session.email, undefined, session.sub);
  if (!access) redirect(`/admin/login?authError=admin_forbidden&returnTo=${encodeURIComponent(pathname)}`);
  if (!adminRouteAllowed(access, pathname)) redirect(adminLanding(access));
  return <div className={styles.shell}><AdminNav access={access} /><div className={styles.workspace}><AdminCommandBar access={access} /><AdminAccessProvider access={access}>{children}</AdminAccessProvider></div></div>;
}
