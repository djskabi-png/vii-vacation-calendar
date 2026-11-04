import type { Metadata } from "next";
import { EventDealPresetPage, eventPresetMetadata } from "../deal-preset-page";
import { serverPublicCopy } from "../../i18n/server-public-copy";
export async function generateMetadata(): Promise<Metadata> { const {language}=await serverPublicCopy(); return eventPresetMetadata("thursday",language); }
export default async function ThursdayEventsPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }){ const params=await searchParams; return <EventDealPresetPage preset="thursday" region={typeof params?.region === "string" ? params.region : undefined}/>; }
