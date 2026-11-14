import { ManagedHomeQuickSearches } from "./managed-home-quick-searches";
import { SearchWorldTabs, type PublicWorldId } from "./world-switcher";
import { TranslatedText } from "./translated-text";
import { SpecialSearchSummary } from "./special-search-summary";

type SpecialWorldSearchProps = {
  active: Extract<PublicWorldId, "trails" | "attractions">;
  targetId: string;
  description: string;
  initialArea?: string;
};

export function SpecialWorldSearch({ active, targetId, description, initialArea }: SpecialWorldSearchProps) {
  return <section className="special-search-rail"><div className="shell">
    <details className="special-search-disclosure">
      <SpecialSearchSummary description={description} initialArea={initialArea} />
      <div className="special-search-panel">
        <SearchWorldTabs active={active} />
        <a className="special-search-local" href={`#${targetId}`}>
          <span><TranslatedText as="strong" text="שינוי המסננים בעמוד הזה" /><TranslatedText as="small" text={description} /></span>
          <b aria-hidden="true">↓</b>
        </a>
      </div>
    </details>
    <div className="world-popular-searches"><ManagedHomeQuickSearches world={active} /></div>
  </div></section>;
}
