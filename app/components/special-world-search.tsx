import { SearchWorldTabs, type PublicWorldId } from "./world-switcher";
import { TranslatedText } from "./translated-text";

type SpecialWorldSearchProps = {
  active: Extract<PublicWorldId, "trails" | "attractions">;
  targetId: string;
  description: string;
};

export function SpecialWorldSearch({ active, targetId, description }: SpecialWorldSearchProps) {
  return <section className="special-search-rail"><div className="shell">
    <details className="special-search-disclosure">
      <summary className="special-search-summary">
        <span><TranslatedText as="strong" text="כל הארץ" /><TranslatedText as="small" text={description} /></span>
        <TranslatedText as="b" text="שינוי חיפוש" />
      </summary>
      <div className="special-search-panel">
        <SearchWorldTabs active={active} />
        <a className="special-search-local" href={`#${targetId}`}>
          <span><TranslatedText as="strong" text="שינוי המסננים בעמוד הזה" /><TranslatedText as="small" text={description} /></span>
          <b aria-hidden="true">↓</b>
        </a>
      </div>
    </details>
  </div></section>;
}
