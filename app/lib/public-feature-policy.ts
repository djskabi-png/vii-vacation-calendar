const NON_PUBLIC_FEATURE_PATTERNS = [
  /(?:אני\s+)?מסכי(?:ם|מה)\/?ה?\s+לקבל\s+(?:דיוור|פרסומ)/i,
  /(?:אישור|הסכמה)\s+(?:לקבלת\s+)?(?:דיוור|פרס(?:ומ|ום))/i,
  /(?:newsletter|marketing)\s+(?:consent|opt[ -]?in)/i,
];

export function isPublicFeatureLabel(value: string) {
  const normalized = value.trim().replace(/\s+/g, " ");
  return Boolean(normalized) && !NON_PUBLIC_FEATURE_PATTERNS.some((pattern) => pattern.test(normalized));
}

function statedGuestCapacity(value: string) {
  const match = value.match(/עד\s*(\d{1,4})\s*(?:אורח(?:ים)?|אנשים|איש)/i);
  return match ? Number(match[1]) : undefined;
}

export function publicFeatureLabels(values: string[], options: { maxGuests?: number } = {}) {
  return [...new Set(values.map((value) => value.trim()).filter((value) => {
    if (!isPublicFeatureLabel(value)) return false;
    const statedCapacity = statedGuestCapacity(value);
    return !statedCapacity || !options.maxGuests || statedCapacity === options.maxGuests;
  }))];
}
