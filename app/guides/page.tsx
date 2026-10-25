import type { Metadata } from "next";
import GuidesPage from "./client-page";
import { magazineArticles } from "../data/magazine-data";
import { managedMagazineArticles } from "../lib/managed-public-content";
import { magazineCard } from "../lib/magazine-card";
import { serverLocalePath, serverPublicCopy } from "../i18n/server-public-copy";

export async function generateMetadata(): Promise<Metadata> {
  const canonical = await serverLocalePath("/guides");
  const { translate } = await serverPublicCopy();
  const title = translate("מדריכי נופש, ספא ואירועים בישראל");
  const description = translate("מדריכים שימושיים, מסלולים, אנשים ורגעים שיעזרו לכם לתכנן פחות וליהנות יותר.");
  return { title, description, alternates: { canonical }, openGraph: { type: "website", url: canonical, title, description } };
}

export default async function Page() {
  const articles = await managedMagazineArticles(magazineArticles);
  return <GuidesPage initialArticles={articles.map(magazineCard)} />;
}
