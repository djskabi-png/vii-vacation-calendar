import type { R2Bucket } from "../../types/cloudflare-runtime";
import { sourceImageMagic } from "./catalog-media-origin-recovery.ts";
import { storedGalleryContentType } from "./gallery-media-identity.ts";
import {
  canonicalSupplierMediaSource, supplierMediaBlobKey, supplierMediaManifestKey,
  supplierMediaSourceFromToken, supplierMediaToken,
} from "./supplier-media-identity.ts";

const MAX_BYTES = 12_000_000;
const MANIFEST_VERSION = 1;
const sourceOperations = new WeakMap<R2Bucket, Map<string, Promise<SupplierMediaReceipt>>>();

export type SupplierMediaManifest = {
  version: 1;
  token: string;
  sourceUrl: string;
  sourceOrigin: string;
  blobKey: string;
  sha256: string;
  contentType: string;
  bytes: number;
  verifiedAt: string;
};

export type SupplierMediaReceipt = {
  token: string;
  sourceUrl: string;
  blobKey: string;
  sha256: string;
  contentType: string;
  bytes: number;
  skipped: boolean;
};

function extension(type: string) {
  return type === "image/jpeg" || type === "image/jfif" ? "jpg" : type.slice("image/".length);
}

async function digest(bytes: Uint8Array) {
  const input = new Uint8Array(bytes.byteLength);
  input.set(bytes);
  const hash = await crypto.subtle.digest("SHA-256", input);
  return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

async function bytes(response: Response) {
  const length = response.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) < 1 || Number(length) > MAX_BYTES)) throw Error("supplier_media_size_invalid");
  if (!response.body) throw Error("supplier_media_body_missing");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      total += part.value.byteLength;
      if (total > MAX_BYTES) { await reader.cancel(); throw Error("supplier_media_too_large"); }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  if (!total || (length && Number(length) !== total)) throw Error("supplier_media_size_mismatch");
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.byteLength; }
  return output;
}

function parseManifest(raw: string, token: string): SupplierMediaManifest | null {
  try {
    const value = JSON.parse(raw) as Partial<SupplierMediaManifest>;
    if (value.version !== MANIFEST_VERSION || value.token !== token
      || supplierMediaToken(value.sourceUrl) !== token
      || typeof value.blobKey !== "string" || !value.blobKey.startsWith("supplier-media/v1/blobs/")
      || typeof value.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(value.sha256)
      || storedGalleryContentType(value.contentType) !== value.contentType
      || !Number.isSafeInteger(value.bytes) || Number(value.bytes) < 1 || Number(value.bytes) > MAX_BYTES
      || typeof value.verifiedAt !== "string" || !Number.isFinite(Date.parse(value.verifiedAt))) return null;
    return value as SupplierMediaManifest;
  } catch { return null; }
}

export async function readSupplierMediaManifest(bucket: R2Bucket, token: string) {
  const object = await bucket.get(supplierMediaManifestKey(token));
  if (!object || object.size > 8_192) return null;
  return parseManifest(await object.text(), token);
}

async function verifiedStored(bucket: R2Bucket, token: string): Promise<SupplierMediaReceipt | null> {
  const manifest = await readSupplierMediaManifest(bucket, token);
  if (!manifest) return null;
  const object = await bucket.head(manifest.blobKey);
  if (!object || object.size !== manifest.bytes
    || storedGalleryContentType(object.httpMetadata?.contentType) !== manifest.contentType
    || object.customMetadata?.sha256 !== manifest.sha256) return null;
  return { ...manifest, skipped: true };
}

export async function archiveSupplierMedia(sourceValue: unknown, bucket: R2Bucket, fetchImpl: typeof fetch = fetch): Promise<SupplierMediaReceipt> {
  const sourceUrl = canonicalSupplierMediaSource(sourceValue);
  const token = supplierMediaToken(sourceUrl);
  if (!sourceUrl || !token) throw Error("supplier_media_source_not_allowed");
  let operations = sourceOperations.get(bucket);
  if (!operations) { operations = new Map(); sourceOperations.set(bucket, operations); }
  const active = operations.get(token);
  if (active) return active;
  const operation = (async () => {
    const stored = await verifiedStored(bucket, token);
    if (stored) return stored;
    const response = await fetchImpl(sourceUrl, {
      redirect: "manual",
      cache: "no-store",
      headers: { Accept: "image/avif,image/webp,image/png,image/jpeg,image/gif" },
      signal: AbortSignal.timeout(10_000),
    });
    if (response.status >= 300 && response.status < 400) { await response.body?.cancel(); throw Error("supplier_media_redirect_not_allowed"); }
    if (!response.ok) { await response.body?.cancel(); throw Error(`supplier_media_http_${response.status}`); }
    const contentType = storedGalleryContentType(response.headers.get("content-type"));
    if (!contentType) { await response.body?.cancel(); throw Error("supplier_media_type_invalid"); }
    const body = await bytes(response);
    if (!sourceImageMagic(body, contentType)) throw Error("supplier_media_magic_invalid");
    const sha256 = await digest(body);
    const blobKey = supplierMediaBlobKey(sha256, extension(contentType));
    const existingBlob = await bucket.head(blobKey);
    if (existingBlob) {
      if (existingBlob.size !== body.byteLength
        || storedGalleryContentType(existingBlob.httpMetadata?.contentType) !== contentType
        || existingBlob.customMetadata?.sha256 !== sha256) throw Error("supplier_media_blob_conflict");
    } else {
      const storedBlob = await bucket.put(blobKey, body, {
        onlyIf: { etagDoesNotMatch: "*" },
        httpMetadata: { contentType },
        customMetadata: { sha256, sourceOrigin: new URL(sourceUrl).origin },
      });
      if (!storedBlob) {
        const winner = await bucket.head(blobKey);
        if (!winner || winner.size !== body.byteLength
          || storedGalleryContentType(winner.httpMetadata?.contentType) !== contentType
          || winner.customMetadata?.sha256 !== sha256) throw Error("supplier_media_blob_race_invalid");
      }
    }
    const manifest: SupplierMediaManifest = {
      version: MANIFEST_VERSION,
      token,
      sourceUrl,
      sourceOrigin: new URL(sourceUrl).origin,
      blobKey,
      sha256,
      contentType,
      bytes: body.byteLength,
      verifiedAt: new Date().toISOString(),
    };
    await bucket.put(supplierMediaManifestKey(token), JSON.stringify(manifest), {
      httpMetadata: { contentType: "application/json" },
      customMetadata: { sha256, sourceOrigin: manifest.sourceOrigin },
    });
    const confirmed = await verifiedStored(bucket, token);
    if (!confirmed) throw Error("supplier_media_persistence_unverified");
    return { ...confirmed, skipped: false };
  })().finally(() => operations?.delete(token));
  operations.set(token, operation);
  return operation;
}

export async function storedSupplierMedia(bucket: R2Bucket, token: string) {
  if (!supplierMediaSourceFromToken(token)) return null;
  const manifest = await readSupplierMediaManifest(bucket, token);
  if (!manifest) return null;
  const object = await bucket.get(manifest.blobKey);
  if (!object || object.size !== manifest.bytes
    || storedGalleryContentType(object.httpMetadata?.contentType) !== manifest.contentType
    || object.customMetadata?.sha256 !== manifest.sha256) throw Error("supplier_media_storage_corrupt");
  return { manifest, object };
}

