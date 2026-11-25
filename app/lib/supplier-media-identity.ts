const SUPPLIER_MEDIA_ROOT = "/api/vii/supplier-media/";
const SPAPLUS_MEDIA_ORIGIN = "https://www.spaplus.co.il";
const SPAPLUS_GALLERY_PREFIX = "/gallery/";
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{40,512}$/;
const FILE_PATTERN = /^[A-Za-z0-9._-]{1,255}\.(?:avif|gif|jfif|jpe?g|png|webp)$/i;
const QUARANTINED = new Set(["1773307880052130.jpeg"]);
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function encode(bytes: Uint8Array) {
  let result = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    result += alphabet[first >> 2];
    result += alphabet[((first & 3) << 4) | ((second ?? 0) >> 4)];
    if (second !== undefined) result += alphabet[((second & 15) << 2) | ((third ?? 0) >> 6)];
    if (third !== undefined) result += alphabet[third & 63];
  }
  return result;
}

function decode(token: string) {
  if (!TOKEN_PATTERN.test(token) || token.length % 4 === 1) return null;
  const bytes: number[] = [];
  for (let index = 0; index < token.length; index += 4) {
    const a = alphabet.indexOf(token[index]);
    const b = alphabet.indexOf(token[index + 1]);
    const c = index + 2 < token.length ? alphabet.indexOf(token[index + 2]) : -1;
    const d = index + 3 < token.length ? alphabet.indexOf(token[index + 3]) : -1;
    if (a < 0 || b < 0 || (index + 2 < token.length && c < 0) || (index + 3 < token.length && d < 0)) return null;
    bytes.push((a << 2) | (b >> 4));
    if (c >= 0) bytes.push(((b & 15) << 4) | (c >> 2));
    if (d >= 0) bytes.push(((c & 3) << 6) | d);
  }
  try { return new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(bytes)); }
  catch { return null; }
}

/** Return the one canonical provider URL that VII is allowed to mirror. */
export function canonicalSupplierMediaSource(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value);
    if (url.origin !== SPAPLUS_MEDIA_ORIGIN || url.username || url.password
      || url.search || url.hash || !url.pathname.startsWith(SPAPLUS_GALLERY_PREFIX)) return null;
    const raw = decodeURIComponent(url.pathname.slice(SPAPLUS_GALLERY_PREFIX.length));
    if (!FILE_PATTERN.test(raw) || raw.includes("/") || QUARANTINED.has(raw.toLowerCase())) return null;
    url.pathname = `${SPAPLUS_GALLERY_PREFIX}${encodeURIComponent(raw)}`;
    return url.href;
  } catch { return null; }
}

export function supplierMediaToken(value: unknown): string | null {
  const source = canonicalSupplierMediaSource(value);
  return source ? encode(new TextEncoder().encode(source)) : null;
}

export function supplierMediaSourceFromToken(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const decoded = decode(value);
  return decoded ? canonicalSupplierMediaSource(decoded) : null;
}

export function localSupplierMediaUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const candidate = value.trim();
  if (candidate.startsWith(SUPPLIER_MEDIA_ROOT)) {
    try {
      const token = decodeURIComponent(candidate.slice(SUPPLIER_MEDIA_ROOT.length));
      return supplierMediaSourceFromToken(token) ? `${SUPPLIER_MEDIA_ROOT}${token}` : null;
    } catch {
      return null;
    }
  }
  const token = supplierMediaToken(candidate);
  return token ? `${SUPPLIER_MEDIA_ROOT}${token}` : null;
}

export function supplierMediaSource(value: unknown): string | null {
  const direct = canonicalSupplierMediaSource(value);
  if (direct) return direct;
  if (typeof value !== "string" || !value.startsWith(SUPPLIER_MEDIA_ROOT)) return null;
  return supplierMediaSourceFromToken(decodeURIComponent(value.slice(SUPPLIER_MEDIA_ROOT.length)));
}

export const SUPPLIER_MEDIA_OBJECT_PREFIX = "supplier-media/v1/";
export const supplierMediaManifestKey = (token: string) => `${SUPPLIER_MEDIA_OBJECT_PREFIX}manifests/${token}.json`;
export const supplierMediaBlobKey = (sha256: string, extension: string) => `${SUPPLIER_MEDIA_OBJECT_PREFIX}blobs/${sha256}.${extension}`;

