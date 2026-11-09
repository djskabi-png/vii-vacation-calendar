const LEGACY_GALLERY_ROOT = "https://www.vii.co.il/gallery/";
const LOCAL_MEDIA_ROOT = "/api/vii/media/";
// A supplier file was published with an embedded "not available" notice.
// Keep the quarantine at the shared normalization boundary so every public
// surface drops it without ever substituting another business's media.
// The second file was still declared for hourly2417, but both the public
// media route and the declared supplier asset returned 404 on 9 Nov 2026.
const QUARANTINED_GALLERY_FILENAMES = new Set(["796a2fc6bf52100.png", "16670505013701.jpg"]);

/** Exact approved quarantine on trusted supplier or local media paths only. */
export function isQuarantinedGalleryMedia(value: unknown) {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value, LEGACY_GALLERY_ROOT);
    // SPA532/package6860: the API-declared package image returned 404 during
    // the complete official-provider byte audit on 9 November 2026.
    if (url.protocol === "https:" && url.hostname === "www.spaplus.co.il"
      && url.pathname === "/gallery/1773307880052130.jpeg") return true;
    const legacy = ["vii.co.il", "www.vii.co.il"].includes(url.hostname) && url.pathname.startsWith("/gallery/");
    const local = value.startsWith(LOCAL_MEDIA_ROOT) || (["vii.spaplus.co", "vii-vacation-calendar.adir-naor-7510.chatgpt.site"].includes(url.hostname) && url.pathname.startsWith(LOCAL_MEDIA_ROOT));
    if (!legacy && !local) return false;
    const filename = decodeURIComponent(url.pathname.slice((legacy ? "/gallery/" : LOCAL_MEDIA_ROOT).length));
    return QUARANTINED_GALLERY_FILENAMES.has(filename.toLowerCase());
  } catch { return false; }
}

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
