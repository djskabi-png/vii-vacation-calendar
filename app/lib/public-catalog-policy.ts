// Supplier rows can be structurally valid while still representing internal
// QA fixtures. This predicate is shared by ingestion and every public read.
export function publicCatalogEntryAllowed(value: unknown) {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  const name = typeof row.name === "string" ? row.name.trim() : typeof row.title === "string" ? row.title.trim() : "";
  const contact = row.contact && typeof row.contact === "object" ? row.contact as Record<string, unknown> : {};
  const phone = [contact.phone, contact.whatsapp, row.phone, row.whatsapp].filter((item): item is string => typeof item === "string").join(" ");
  const fixtureName = /(?:^|\s)test\d*(?:\s|$)|המתחם\s+הקטלני\s+של\s+רועי/i.test(name);
  const fixtureIdentity = fixtureName && /(?:^|\D)050[-\s]?123[-\s]?4567(?:\D|$)/.test(phone);
  return Boolean(name) && !fixtureName && !fixtureIdentity;
}
