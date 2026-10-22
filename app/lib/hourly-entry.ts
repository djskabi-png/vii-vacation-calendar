export type HourlyEntryMode = "no-meeting" | "with-meeting";

function normalizedEntryEvidence(values: Array<string | undefined>) {
  return values.filter(Boolean).join(" · ").replace(/[\u200e\u200f]/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Entrance mode is a public trust fact. Derive it only from explicit supplier/API wording.
 * Payment without a meeting, on its own, does not prove that entrance is contactless.
 */
export function hourlyEntryMode(values: Array<string | undefined>): HourlyEntryMode | undefined {
  const evidence = normalizedEntryEvidence(values);
  if (!evidence) return undefined;
  if (/(?:כניסה|הגעה|קבלת\s*(?:החדר|המפתח))[^.·]{0,45}(?:עם\s*מפגש|כוללת?\s*מפגש|במפגש\s*עם)/.test(evidence)
    || /מפגש\s*עם\s*(?:נציג|בעל(?:י)?\s*המקום|הצוות)[^.·]{0,45}(?:בכניסה|בעת\s*הכניסה|בהגעה)/.test(evidence)) {
    return "with-meeting";
  }
  if (/(?:כניסה|הגעה|קבלת\s*(?:החדר|המפתח))[^.·]{0,55}(?:ללא\s*מפגש|בלי\s*מפגש)/.test(evidence)
    || /(?:ללא\s*מפגש|בלי\s*מפגש)[^.·]{0,55}(?:בכניסה|בעת\s*הכניסה|בהגעה)/.test(evidence)
    || /כניסה\s*(?:עצמאית|עצמית)/.test(evidence)
    || /כניסה[^.·]{0,35}(?:דיסקרטית|נפרדת|פרטית)[^.·]{0,55}(?:תשלום|קבלה)[^.·]{0,35}(?:ללא\s*מפגש|בלי\s*מפגש)/.test(evidence)) {
    return "no-meeting";
  }
  return undefined;
}
