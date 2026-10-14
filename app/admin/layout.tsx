import type { Metadata } from "next";
import AdminCommandBar from "./admin-command-bar";
import AdminNav from "./admin-nav";
import styles from "./admin.module.css";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className={styles.shell}><AdminNav /><div className={styles.workspace}><AdminCommandBar />{children}</div></div>;
}
