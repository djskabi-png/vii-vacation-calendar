"use client";

import { useSiteLanguage } from "../i18n/locale-provider";

type TranslatedTextProps = {
  as?: "span" | "strong" | "small" | "b";
  text: string;
};

export function TranslatedText({ as = "span", text }: TranslatedTextProps) {
  const { translate } = useSiteLanguage();
  const Tag = as;
  return <Tag>{translate(text)}</Tag>;
}
