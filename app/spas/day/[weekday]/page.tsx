import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SpaWeekdayPage, spaWeekdayMetadata } from "../../deal-weekday-page";
import { spaWeekdaySlugs, type SpaWeekdaySlug } from "../../../lib/spa-weekday-pages";
import { serverPublicCopy } from "../../../i18n/server-public-copy";
export function generateStaticParams() { return spaWeekdaySlugs.map(weekday => ({ weekday })); }
function acceptedWeekday(value: string): SpaWeekdaySlug {
  if (!spaWeekdaySlugs.includes(value as SpaWeekdaySlug)) notFound();
  return value as SpaWeekdaySlug;
}
export async function generateMetadata({ params }: { params: Promise<{ weekday: string }> }): Promise<Metadata> {
  const { weekday } = await params;
  const { language } = await serverPublicCopy();
  return spaWeekdayMetadata(acceptedWeekday(weekday), language);
}
export default async function SpaWeekdayRoute({ params }: { params: Promise<{ weekday: string }> }) {
  const { weekday } = await params;
  return <SpaWeekdayPage weekday={acceptedWeekday(weekday)} />;
}
