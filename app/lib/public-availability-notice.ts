type Language = "he" | "en" | "ru" | "fr";
type State = { requestedDate: string; checkingDate: boolean; status: "idle" | "loading" | "ready" | "unavailable"; dateCovered: boolean };

const copy = {
  he: { loading: "בודקים זמינות...", unconfirmed: "הזמינות לתאריך שבחרתם לא אושרה. בדקו מול המקום." },
  en: { loading: "Checking availability...", unconfirmed: "Availability for your date is not confirmed. Please check with the venue." },
  ru: { loading: "Проверяем наличие мест...", unconfirmed: "Наличие мест на выбранную дату не подтверждено. Уточните у администрации." },
  fr: { loading: "Vérification des disponibilités...", unconfirmed: "La disponibilité à cette date n’est pas confirmée. Renseignez-vous auprès de l’établissement." },
} as const;

export function publicAvailabilityNotice(state: State, language: Language) {
  if (!state.requestedDate) return null;
  if (state.checkingDate || state.status === "idle" || state.status === "loading") return { kind: "loading", text: copy[language].loading } as const;
  if (state.status === "unavailable" || !state.dateCovered) return { kind: "unconfirmed", text: copy[language].unconfirmed } as const;
  return null;
}
