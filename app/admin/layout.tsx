import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authorizedAdminSession } from "../lib/admin-session.ts";
import { readSession } from "../lib/google-auth.ts";
import AdminCommandBar from "./admin-command-bar";
import AdminNav from "./admin-nav";
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
  const request = requestFromHeaders(requestHeaders, pathname);
  const session = await readSession(request).catch(() => null);
  if (!session) redirect(`/api/auth/google?returnTo=${encodeURIComponent(pathname)}`);
  if (!await authorizedAdminSession(request)) redirect("/account?authError=admin_forbidden");
  return <div className={styles.shell}><AdminNav /><div className={styles.workspace}><AdminCommandBar />{children}</div></div>;
}
