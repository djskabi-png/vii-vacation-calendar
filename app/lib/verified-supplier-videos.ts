import type { ListingVideo } from "../data/site-data";
import legacySupplierVideoInventory from "../data/verified-legacy-supplier-videos.ts";
type VerifiedLegacyVideo = { title: string; youtubeId: string; sourceUrl: string; verifiedAt: string };
export const legacySupplierVideos = legacySupplierVideoInventory as unknown as Record<string, VerifiedLegacyVideo[]>;
function youtubeEmbed(id: string) { return `https://www.youtube-nocookie.com/embed/${id}`; }
export function verifiedSupplierVideosFor(slug: string, poster: string): ListingVideo[] {
  const source = legacySupplierVideos[slug];
  if (!source?.length || !poster) return [];
  return source.map((video) => {
    const embedUrl = youtubeEmbed(video.youtubeId);
    return { title: video.title, poster, note: "", src: embedUrl, embedUrl };
  });
}
export function attachVerifiedSupplierVideo<T extends { slug: string; image: string; videos?: ListingVideo[] }>(property: T): T {
  // A supplier response may explicitly contain an empty array while the
  // accepted legacy inventory still has a verified real video. Preserve any
  // current supplier video, but let an empty list use that verified fallback.
  if (property.videos?.length) return property;
  const videos = verifiedSupplierVideosFor(property.slug, property.image);
  return videos.length ? { ...property, videos } : property;
}
export function isSafeYoutubeEmbed(url: string) {
  try { const parsed = new URL(url); return parsed.protocol === "https:" && parsed.hostname === "www.youtube-nocookie.com" && !parsed.username && !parsed.password && !parsed.port && !parsed.search && !parsed.hash && /^\/embed\/[A-Za-z0-9_-]{11}$/.test(parsed.pathname); } catch { return false; }
}
