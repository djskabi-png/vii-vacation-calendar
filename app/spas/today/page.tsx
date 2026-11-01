import type { Metadata } from "next";
import { serverPublicCopy } from "../../i18n/server-public-copy";
import { SpaDealDayPage, spaDealDayMetadata } from "../deal-day-page";
export async function generateMetadata():Promise<Metadata>{const {language}=await serverPublicCopy();return spaDealDayMetadata(language,"today");}
export default function SpaTodayPage(){return <SpaDealDayPage day="today"/>;}
