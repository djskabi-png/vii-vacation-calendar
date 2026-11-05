const LEGACY_GALLERY_ROOT = "https://www.vii.co.il/gallery/";
const LOCAL_MEDIA_ROOT = "/api/vii/media/";
// A supplier file was published with an embedded "not available" notice.
// Keep the quarantine at the shared normalization boundary so every public
// surface drops it without ever substituting another business's media.
const QUARANTINED_GALLERY_FILENAMES = new Set(["796a2fc6bf52100.png"]);

function validGalleryFilename(value: string) {
  return /^[A-Za-z0-9._-]+\.(?:avif|gif|jfif|jpe?g|png|webp)$/i.test(value)
    && !QUARANTINED_GALLERY_FILENAMES.has(value.toLowerCase())
    ? value
    : null;
}

function localFilename(value: string) {
  try {
    const url = new URL(value, "https://vii.spaplus.co");
    if (!url.pathname.startsWith(LOCAL_MEDIA_ROOT)) return null;
    return validGalleryFilename(decodeURIComponent(url.pathname.slice(LOCAL_MEDIA_ROOT.length)));
  } catch {
    return null;
  }
}

export function legacyGalleryFilename(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    if (value.startsWith(LOCAL_MEDIA_ROOT)) return localFilename(value);
    const url = new URL(value, LEGACY_GALLERY_ROOT);
    if (!(["vii.co.il", "www.vii.co.il"].includes(url.hostname)) || !url.pathname.startsWith("/gallery/")) return null;
    const filename = decodeURIComponent(url.pathname.slice("/gallery/".length));
    return validGalleryFilename(filename);
  } catch { return null; }
}

export function localGalleryMediaUrl(value: unknown) {
  const filename = legacyGalleryFilename(value);
  if (filename) return `${LOCAL_MEDIA_ROOT}${encodeURIComponent(filename)}`;
  if (typeof value !== "string") return null;
  const candidate = value.trim();
  if (!candidate) return null;
  if (candidate.startsWith(LOCAL_MEDIA_ROOT)) {
    const filename = localFilename(candidate);
    return filename ? `${LOCAL_MEDIA_ROOT}${encodeURIComponent(filename)}` : null;
  }
  if (candidate.startsWith("/gallery/")) {
    const filename = legacyGalleryFilename(candidate);
    return filename ? `${LOCAL_MEDIA_ROOT}${encodeURIComponent(filename)}` : null;
  }
  if (candidate.startsWith("/") && !candidate.startsWith("//")) return candidate;
  return null;
}
