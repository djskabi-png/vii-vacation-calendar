import { Images } from "lucide-react";

export function GalleryActionContent({ label, meta }: { label: string; meta?: string }) {
  return <span className="gallery-action-content">
    <Images aria-hidden="true" focusable="false" />
    <span className="gallery-action-content__label">{label}</span>
    {meta ? <small className="gallery-action-content__meta">{meta}</small> : null}
  </span>;
}
