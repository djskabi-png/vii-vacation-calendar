import type { ListingVideo } from "../data/site-data";
export const legacySupplierVideos: Record<string, { title: string; youtubeId: string; sourceUrl: string; verifiedAt: string }> = {
  "vacation-2356": { title: "סרטון מהמקום", youtubeId: "WNhfp-IKebA", sourceUrl: "https://www.vii.co.il/Shilo_Suites", verifiedAt: "2026-11-08" },
};
function youtubeEmbed(id: string) { return `https://www.youtube-nocookie.com/embed/${id}`; }
export function verifiedSupplierVideoFor(slug: string, poster: string): ListingVideo | undefined {
  const source = legacySupplierVideos[slug];
  if (!source || !poster) return undefined;
  const embedUrl = youtubeEmbed(source.youtubeId);
  return { title: source.title, poster, note: "", src: embedUrl, embedUrl };
}
export function attachVerifiedSupplierVideo<T extends { slug: string; image: string; videos?: ListingVideo[] }>(property: T): T {
  if (property.videos !== undefined) return property;
  const video = verifiedSupplierVideoFor(property.slug, property.image);
  return video ? { ...property, videos: [video] } : property;
}
export function isSafeYoutubeEmbed(url: string) {
  try { const parsed = new URL(url); return parsed.protocol === "https:" && parsed.hostname === "www.youtube-nocookie.com" && !parsed.username && !parsed.password && !parsed.port && !parsed.search && !parsed.hash && /^\/embed\/[A-Za-z0-9_-]{11}$/.test(parsed.pathname); } catch { return false; }
}
