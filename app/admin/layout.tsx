import type { Metadata } from "next";
import AdminNav from "./admin-nav";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <><AdminNav />{children}</>;
}
