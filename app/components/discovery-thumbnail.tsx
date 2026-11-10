"use client";

import { useState, type ImgHTMLAttributes } from "react";
import manifest from "../data/discovery-thumbnails.generated.json";
import { imageTitle } from "../lib/image-metadata";

type ImageMetadataProps = { alt: string; title?: string; "data-image-role"?: "decorative" | "content" };

const thumbnails: Readonly<Record<string, { src: string; width: number; height: number }>> = manifest.entries;

/** Small discovery tiles use a derivative of the same photo. Galleries keep
 * their original source. CMS images without a built derivative remain intact. */
export function DiscoveryThumbnail({ src, alt, onError, ...props }: Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt" | "title"> & ImageMetadataProps & { src: string }) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const thumbnail = failedSource === src ? undefined : thumbnails[src];
  return <img width={thumbnail?.width} height={thumbnail?.height} {...props} alt={alt} title={imageTitle(alt, props.title, props["data-image-role"] === "decorative")}
    src={thumbnail?.src || src} onError={(event) => {
      if (thumbnail) { setFailedSource(src); return; }
      onError?.(event);
    }} />;
}
