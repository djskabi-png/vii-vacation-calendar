export const cardImageWidths = [384, 640, 750, 828] as const;

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
  return `/_vinext/image?url=${encodeURIComponent(src)}&w=${width}&q=${quality}`;
}

export function responsiveCardMedia(src: string, quality = 82) {
  if (!isOptimizableCardMedia(src)) return { src, srcSet: undefined };
  return {
    src: optimizedCardMediaUrl(src, cardImageWidths.at(-1) || 828, quality),
    srcSet: cardImageWidths.map((width) => `${optimizedCardMediaUrl(src, width, quality)} ${width}w`).join(", "),
  };
}
