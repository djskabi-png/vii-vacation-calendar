"use client";

import { useSyncExternalStore } from "react";
import { editorialImageCopy } from "../data/editorial-image-copy";
import { useSiteLanguage } from "../i18n/locale-provider";

export function EditorialCover({ slug, src, alt, title, priority = false }: { slug: string; src: string; alt: string; title?: string; priority?: boolean }) {
  const { language } = useSiteLanguage();
  const hydrated = useSyncExternalStore(() => () => undefined, () => true, () => false);
  const activeLanguage = hydrated ? language : "he";
  const copy = activeLanguage !== "he" && src === `/media/editorial/${slug}.webp` ? editorialImageCopy[slug]?.[activeLanguage] : undefined;
  return <img src={src} alt={copy?.alt || alt} title={copy?.title || title || alt} width={1200} height={800}
    loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"} decoding="async" data-no-translate />;
}

export function EditorialIllustrationLabel() {
  const { language } = useSiteLanguage();
  const hydrated = useSyncExternalStore(() => () => undefined, () => true, () => false);
  const labels = { he: "תמונת המחשה", en: "Illustrative image", fr: "Image d’illustration", ru: "Иллюстрация" };
  return <small className="editorial-illustration" data-no-translate>{labels[hydrated ? language : "he"]}</small>;
}
