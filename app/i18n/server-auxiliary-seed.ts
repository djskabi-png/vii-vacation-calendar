import legacyVacationUiTranslations from "../data/legacy-vacation-ui-translations.json";
import bookingHubTranslations from "../data/booking-hub-translations.json";
import hourlyUiTranslations from "../data/hourly-ui-translations.json";
import providerJoinTranslations from "../data/provider-join-translations.json";
import spaUiTranslations from "../data/spa-ui-translations.json";
import catalogAdminTranslations from "../data/catalog-admin-translations.json";
import emailPolishTranslations from "../data/email-polish-translations.json";
import worldDepthTranslations from "../data/world-depth-translations.json";
import visitorUiTranslations from "../data/visitor-ui-translations.json";
import publicReviewTranslations from "../data/public-review-translations.json";

export type AuxiliarySeedLanguage = "en" | "ru" | "fr";
export type AuxiliarySeedDictionary = Record<string, string>;
export type AuxiliarySeed = {
  legacyVacationUiTranslations: AuxiliarySeedDictionary;
  bookingHubTranslations: AuxiliarySeedDictionary;
  hourlyUiTranslations: AuxiliarySeedDictionary;
  providerJoinTranslations: AuxiliarySeedDictionary;
  spaUiTranslations: AuxiliarySeedDictionary;
  catalogAdminTranslations: AuxiliarySeedDictionary;
  emailPolishTranslations: AuxiliarySeedDictionary;
  worldDepthTranslations: AuxiliarySeedDictionary;
  visitorUiTranslations: AuxiliarySeedDictionary;
  publicReviewTranslations: AuxiliarySeedDictionary;
};

function select(source: Record<string, Record<string, string>>, language: AuxiliarySeedLanguage): AuxiliarySeedDictionary {
  return Object.fromEntries(Object.entries(source).flatMap(([key, values]) => values[language] === undefined ? [] : [[key, values[language]]]));
}

export function getAuxiliarySeed(language: AuxiliarySeedLanguage): AuxiliarySeed {
  return {
    legacyVacationUiTranslations: select(legacyVacationUiTranslations, language),
    bookingHubTranslations: select(bookingHubTranslations, language),
    hourlyUiTranslations: select(hourlyUiTranslations, language),
    providerJoinTranslations: select(providerJoinTranslations, language),
    spaUiTranslations: select(spaUiTranslations, language),
    catalogAdminTranslations: select(catalogAdminTranslations, language),
    emailPolishTranslations: select(emailPolishTranslations, language),
    worldDepthTranslations: select(worldDepthTranslations, language),
    visitorUiTranslations: select(visitorUiTranslations, language),
    publicReviewTranslations: select(publicReviewTranslations, language),
  };
}
