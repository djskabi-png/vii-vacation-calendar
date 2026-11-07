"use client";

import { useState, type ImgHTMLAttributes } from "react";
import manifest from "../data/discovery-thumbnails.generated.json";

const thumbnails: Readonly<Record<string, { src: string; width: number; height: number }>> = manifest.entries;

/** Small discovery tiles use a derivative of the same photo. Galleries keep
 * their original source. CMS images without a built derivative remain intact. */
export function DiscoveryThumbnail({ src, onError, ...props }: Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & { src: string }) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const thumbnail = failedSource === src ? undefined : thumbnails[src];
  return <img width={thumbnail?.width} height={thumbnail?.height} {...props}
    src={thumbnail?.src || src} onError={(event) => {
      if (thumbnail) { setFailedSource(src); return; }
      onError?.(event);
    }} />;
}
