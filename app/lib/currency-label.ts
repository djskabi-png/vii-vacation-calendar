/** Preserve surrounding copy while isolating supplier-supplied shekel amounts. */
export function currencyLabelParts(label: string) {
  // Keep the supplier's exact digits, grouping and decimal separators. Direction
  // controls from Intl/supplier strings are separators, never part of an amount.
  const amountPattern = String.raw`[+\-−]?(?:\d{1,3}(?:[ \u00a0\u202f]\d{3})+|\d+)(?:[.,]\d+)*`;
  const currencyPattern = /(?:₪|ש["״]ח)/.source;
  const gap = String.raw`[\s\u200e\u200f\u061c]*`;
  const pattern = new RegExp(`(?<leadingSign>[+\\-−])?${currencyPattern}${gap}(?<prefix>${amountPattern})|(?<suffix>${amountPattern})${gap}${currencyPattern}`, "g");
  const parts: Array<{ text: string; amount?: string }> = [];
  let from = 0;
  for (const match of label.matchAll(pattern)) {
    const index = match.index!;
    if (index > from) parts.push({ text: label.slice(from, index) });
    const amount = match.groups!.prefix !== undefined
      ? (match.groups!.leadingSign || "") + match.groups!.prefix
      : match.groups!.suffix;
    parts.push({ text: `₪\u00a0${amount}`, amount });
    from = index + match[0].length;
  }
  if (from < label.length) parts.push({ text: label.slice(from) });
  return parts;
}
