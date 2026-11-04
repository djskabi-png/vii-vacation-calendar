/** Preserve surrounding copy while isolating supplier-supplied shekel amounts. */
export function currencyLabelParts(label: string) {
  const pattern = /(?:₪|ש["״]ח)\s*(\d[\d,.]*)|(\d[\d,.]*)\s*(?:₪|ש["״]ח)/g;
  const parts: Array<{ text: string; amount?: string }> = [];
  let from = 0;
  for (const match of label.matchAll(pattern)) {
    const index = match.index!;
    if (index > from) parts.push({ text: label.slice(from, index) });
    const amount = match[1] || match[2];
    parts.push({ text: `₪\u00a0${amount}`, amount });
    from = index + match[0].length;
  }
  if (from < label.length) parts.push({ text: label.slice(from) });
  return parts;
}
