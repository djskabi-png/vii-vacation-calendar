import { permanentRedirect } from "next/navigation";
import { headers } from "next/headers";
import { localizedPath, type SiteLanguage } from "../i18n/locale-routing";

export default async function ContactPage() {
  const locale = (await headers()).get("x-vii-locale");
  const language: SiteLanguage = locale === "en" || locale === "fr" || locale === "ru" ? locale : "he";
  permanentRedirect(localizedPath("/join", language));
}
