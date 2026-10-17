import type { MagazineArticle, MagazineSection } from "../data/magazine-data";

export function magazineBodySource(article: Pick<MagazineArticle, "intro" | "sections">): string {
  return [article.intro, ...article.sections.map(section => [
    "## " + section.title, ...section.paragraphs,
    ...(section.bullets || []).map(item => "- " + item),
    ...(section.tip ? [section.tip] : []),
  ].join("\n\n"))].join("\n\n");
}

// Preserve existing intro-only overrides. A new structured body replaces the
// actual sections, never duplicates the whole article inside the lead.
export function magazineBodyOverride(body: string, fallback: Pick<MagazineArticle, "intro" | "sections">) {
  if (!/^##\s/m.test(body)) return { intro: body || fallback.intro, sections: fallback.sections };
  const chunks = body.split(/^##\s+/m);
  const sections: MagazineSection[] = chunks.slice(1).map((chunk, index) => {
    const [title, ...lines] = chunk.trim().split("\n");
    const blocks = lines.join("\n").split(/\n\s*\n/).map(value => value.trim()).filter(Boolean);
    return { id: "edited-" + (index + 1), title: title.trim(),
      paragraphs: blocks.filter(value => !value.startsWith("- ")),
      bullets: blocks.filter(value => value.startsWith("- ")).flatMap(value => value.split("\n").map(line => line.replace(/^-\s*/, ""))) };
  }).filter(section => section.title && (section.paragraphs.length || section.bullets?.length));
  return sections.length ? { intro: chunks[0].trim(), sections } : fallback;
}
