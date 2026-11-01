import type { Metadata } from "next";
import { serverPublicCopy } from "../../i18n/server-public-copy";
import { SpaDealDayPage, spaDealDayMetadata } from "../deal-day-page";
export async function generateMetadata():Promise<Metadata>{const {language}=await serverPublicCopy();return spaDealDayMetadata(language,"tomorrow");}
export default function SpaTomorrowPage(){return <SpaDealDayPage day="tomorrow"/>;}
