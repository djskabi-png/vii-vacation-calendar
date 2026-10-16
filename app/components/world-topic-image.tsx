import type { WorldTopicImage as TopicImage } from "../lib/world-topic-media";

export function WorldTopicImage({ image }: { image: TopicImage }) {
  const mobile = image.src.replace(/-v1\.webp$/, "-v1-small.webp");
  return <figure className="world-topic-image">
    <img src={image.src} srcSet={mobile !== image.src ? `${mobile} 640w, ${image.src} 1200w` : undefined}
      sizes="(max-width: 720px) 92vw, 42vw" width={1200} height={800}
      alt={image.alt} title={image.alt} loading="eager" fetchPriority="high" decoding="async" />
    <figcaption>תמונת המחשה</figcaption>
  </figure>;
}
