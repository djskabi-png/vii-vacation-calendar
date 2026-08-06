import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "החשבון האישי שלי",
  robots: { index: false, follow: false },
};

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return children;
}
