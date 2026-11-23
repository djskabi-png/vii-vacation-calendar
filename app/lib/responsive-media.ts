export const defaultCardImageSizes = "(max-width: 760px) calc(100vw - 32px), (max-width: 1180px) 50vw, 420px";
export const cardImageWidths = [384, 640, 750, 828] as const;
export const heroImageWidths = [640, 1080, 1200, 1920] as const;

export function isOptimizableCardMedia(src: string) {
  if (!src.startsWith("/api/vii/media/") || src.includes("?") || src.includes("#")) return false;
  const encoded = src.slice("/api/vii/media/".length);
  if (!encoded || encoded.includes("/") || encoded.includes("\\")) return false;
  try {
    const filename = decodeURIComponent(encoded);
    return /^[A-Za-z0-9._-]+\.(?:avif|gif|jfif|jpe?g|png|webp)$/i.test(filename) && !filename.includes("..");
  } catch {
    return false;
  }
}

export function optimizedCardMediaUrl(src: string, width: number, quality = 82) {
  // Keep the first request on the public VII origin. A separate workers.dev
  // hostname adds a cold redirect and can be blocked independently by mobile
  // privacy/network layers, leaving an otherwise valid gallery blank.
  return `/_vinext/image?url=${encodeURIComponent(src)}&w=${width}&q=${quality}`;
}

export function responsiveCardMedia(src: string, quality = 82, widths: readonly number[] = cardImageWidths) {
  if (!isOptimizableCardMedia(src)) return { src, srcSet: undefined };
  return {
    src: optimizedCardMediaUrl(src, widths.at(-1) || 828, quality),
    srcSet: widths.map((width) => `${optimizedCardMediaUrl(src, width, quality)} ${width}w`).join(", "),
  };
}
