import Image from "next/image";
import Link from "next/link";
import { LogIn, ShieldCheck } from "lucide-react";
import { headers } from "next/headers";
import { readAdminSession, safeReturnTo } from "../../lib/google-auth.ts";
import styles from "./login.module.css";

const errorCopy: Record<string, string> = {
  admin_forbidden: "החשבון שנבחר אינו מורשה להיכנס למערכת הניהול.",
  cancelled: "הכניסה בוטלה. אפשר לבחור חשבון מנהל ולנסות שוב.",
  invalid_state: "תוקף בקשת הכניסה פג. התחילו כניסה חדשה.",
  not_configured: "שירות הכניסה למנהלים אינו זמין כרגע.",
  token_exchange_failed: "Google לא השלים את הכניסה. אפשר לנסות שוב.",
  profile_unavailable: "לא הצלחנו לאמת את חשבון המנהל שנבחר.",
  provider_unavailable: "שירות Google אינו זמין כרגע. אפשר לנסות שוב בעוד רגע.",
};

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const returnTo = safeReturnTo(typeof params.returnTo === "string" ? params.returnTo : "/admin", "admin");
  const errorCode = typeof params.authError === "string" ? params.authError : "";
  const error = errorCopy[errorCode] || null;
  const loggedOut = params.loggedOut === "1";
  const requestHeaders = await headers();
  const cookie = requestHeaders.get("cookie");
  const attemptedAccount = errorCode === "admin_forbidden" && cookie
    ? await readAdminSession(new Request("https://vii.spaplus.co/admin/login", { headers: { cookie } })).catch(() => null)
    : null;
  const loginHref = `/api/auth/google?audience=admin&returnTo=${encodeURIComponent(returnTo)}`;
  return <main className={styles.page} id="main-content" dir="rtl">
    <section className={styles.card} aria-labelledby="admin-login-title">
      <Image className={styles.logo} src="/vii-logo.png" width={160} height={122} priority unoptimized alt="וי פור ויקיישן" title="וי פור ויקיישן" />
      <div className={styles.identity}><ShieldCheck size={22} aria-hidden="true" /><span>VII Control</span></div>
      <h1 id="admin-login-title">כניסה למערכת הניהול</h1>
      <p>הכניסה מיועדת למנהלי VII ולעובדים שקיבלו הרשאה. חשבון הלקוחות באתר נשאר נפרד.</p>
      {loggedOut ? <div className={styles.success} role="status">התנתקתם ממערכת הניהול.</div> : null}
      {error ? <div className={styles.error} role="alert">{attemptedAccount ? <><strong>החשבון שנבחר:</strong><bdi dir="ltr">{attemptedAccount.email}</bdi><span>לחשבון הזה אין הרשאת ניהול. לחצו שוב ובחרו בחשבון Google שעבורו נשמרה ההרשאה.</span></> : error}</div> : null}
      <a className={styles.login} href={loginHref}><LogIn size={19} aria-hidden="true" /><span>{attemptedAccount ? "בחירת חשבון Google אחר" : "כניסה עם חשבון מנהל"}</span></a>
      <Link className={styles.publicLink} href="/">חזרה לאתר VII</Link>
    </section>
  </main>;
}
