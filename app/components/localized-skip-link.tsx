"use client";

import { useSiteLanguage } from "../i18n/locale-provider";

export function LocalizedSkipLink() {
  const { translate } = useSiteLanguage();
  return <a className="skip-link" href="#main-content">{translate("דילוג לתוכן")}</a>;
}
