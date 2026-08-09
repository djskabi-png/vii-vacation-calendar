import type { Metadata } from "next";
import { notFound } from "next/navigation";
export const metadata: Metadata = { title: "מרכז מידע לצוות", robots: { index: false, follow: false } };
export default function HandoffPage(){ notFound(); }
