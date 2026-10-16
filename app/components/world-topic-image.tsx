import type { WorldTopicImage as TopicImage } from "../lib/world-topic-media";
import { worldTopicImageCopy } from "../lib/world-topic-media";
import { headers } from "next/headers";

export async function WorldTopicImage({ image }: { image: TopicImage }) {
  const copy = worldTopicImageCopy(image, (await headers()).get("x-vii-locale") || "he");
  const mobile = image.src.replace(/-v1\.webp$/, "-v1-small.webp");
  return <figure className="world-topic-image">
    <img src={image.src} srcSet={mobile !== image.src ? `${mobile} 640w, ${image.src} 1200w` : undefined}
      sizes="(max-width: 720px) 92vw, 42vw" width={1200} height={800}
      alt={copy.alt} title={copy.alt} loading="eager" fetchPriority="high" decoding="async" />
    <figcaption>{copy.caption}</figcaption>
  </figure>;
}
