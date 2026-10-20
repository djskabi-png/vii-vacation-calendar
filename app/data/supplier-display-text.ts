// Supplier catalog copy is descriptive evidence, not an authorized live quote.
// Keep the imported snapshot intact and omit monetary claims from public copy.
export function supplierDisplayDescription(place: { description: string; name: string; location: string; area: string }): string {
  const monetaryClaim = /(?:[₪$€£]\s*\d|\d[\d.,\s]*\s*(?:₪|ש״ח|ש"ח|שקלים|ILS\b|USD\b|EUR\b|\$|€|£))/iu;
  const description = place.description
    .replace(/<[^>]*>/g, " ")
    .replace(/&(?:nbsp|#160|#x0*a0);/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/&quot;/giu, '"')
    .replace(/&(?:apos|#39|#x0*27);/giu, "'")
    .replace(/&lt;/giu, "<")
    .replace(/&gt;/giu, ">")
    .replace(/\s+/g, " ")
    .replace(/^תיאור שיווקי לעמוד בגוגל:\s*/, "")
    .trim();
  const safe = description.split(/(?<=[.!?])\s+|\n+/).filter((sentence) => !monetaryClaim.test(sentence)).join(" ").trim();
  return safe || `${place.name}, ${place.location}, ${place.area}.`;
}
