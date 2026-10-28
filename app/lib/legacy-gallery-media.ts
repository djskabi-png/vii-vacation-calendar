const LEGACY_GALLERY_ROOT = "https://www.vii.co.il/gallery/";
const LOCAL_MEDIA_ROOT = "/api/vii/media/";

export function legacyGalleryFilename(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    if (value.startsWith(LOCAL_MEDIA_ROOT)) {
      const filename = decodeURIComponent(value.slice(LOCAL_MEDIA_ROOT.length));
      return /^[A-Za-z0-9._-]+\.(?:avif|gif|jfif|jpe?g|png|webp)$/i.test(filename) ? filename : null;
    }
    const url = new URL(value, LEGACY_GALLERY_ROOT);
    if (!(["vii.co.il", "www.vii.co.il"].includes(url.hostname)) || !url.pathname.startsWith("/gallery/")) return null;
    const filename = decodeURIComponent(url.pathname.slice("/gallery/".length));
    return /^[A-Za-z0-9._-]+\.(?:avif|gif|jfif|jpe?g|png|webp)$/i.test(filename) ? filename : null;
  } catch { return null; }
}

export function localGalleryMediaUrl(value: unknown) {
  const filename = legacyGalleryFilename(value);
  if (filename) return `${LOCAL_MEDIA_ROOT}${encodeURIComponent(filename)}`;
  if (typeof value !== "string") return null;
  const candidate = value.trim();
  if (!candidate) return null;
  if (candidate.startsWith("/") && !candidate.startsWith("//")) return candidate;
  return null;
}
