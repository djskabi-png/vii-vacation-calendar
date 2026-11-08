const rasterTypes = new Set(['image/avif', 'image/gif', 'image/jpeg', 'image/jfif', 'image/png', 'image/webp']);
// This namespace contains public supplier gallery media only. Other uploads
// (including private documents) must never share this prefix.
export const PUBLIC_GALLERY_OBJECT_PREFIX = 'legacy-gallery/v1/';

/** A public gallery filename is a single immutable object identity, never a path. */
export function validGalleryFilename(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 255 && !value.includes('..')
    && /^[A-Za-z0-9._-]+\.(?:avif|gif|jfif|jpe?g|png|webp)$/i.test(value);
}

export function storedGalleryContentType(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const type = value.split(';', 1)[0].trim().toLowerCase();
  return rasterTypes.has(type) ? type : null;
}
