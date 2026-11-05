"use client";
import { useSearchParams } from "next/navigation";
import { TranslatedText } from "./translated-text";

export function SpecialSearchSummary({ description, initialArea }: { description: string; initialArea?: string }) {
  const params = useSearchParams();
  const area = params.get("area") || params.get("location") || initialArea || "כל הארץ";
  return <summary className="special-search-summary">
    <span><TranslatedText as="strong" text={area} /><TranslatedText as="small" text={description} /></span>
    <TranslatedText as="b" text="שינוי חיפוש" />
  </summary>;
}
