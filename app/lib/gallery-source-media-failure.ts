/** Source-file failures may preserve a supplier's last-good media. Internal R2,
 * checksum, ownership and transaction failures must never use this path. */
export function reviewableGallerySourceFailure(code:unknown):code is string {
  return typeof code==='string' && (/^archive_source_http_(?:400|403|404|410)$/.test(code)
    || ['archive_image_type_invalid','archive_image_magic_invalid','archive_image_body_missing','archive_image_size_invalid','archive_image_size_mismatch','archive_image_too_large'].includes(code));
}
