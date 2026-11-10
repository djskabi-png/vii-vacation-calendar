"use client";

/* eslint-disable @next/next/no-img-element */

import { useLayoutEffect, useRef, type ImgHTMLAttributes } from "react";
import { imageTitle } from "../lib/image-metadata";

type ImageMetadataProps = { alt: string; title?: string; "data-image-role"?: "decorative" | "content" };

export function ResilientImage({ onFailure, ...props }: Omit<ImgHTMLAttributes<HTMLImageElement>, "alt" | "title"> & ImageMetadataProps & { src: string; onFailure: () => void }) {
  const imageRef = useRef<HTMLImageElement>(null);
  useLayoutEffect(() => {
    const image = imageRef.current;
    // The request may fail before hydration attaches onError. The decoded
    // state is therefore part of the contract, not just the error event.
    if (image?.complete && image.naturalWidth === 0) onFailure();
  }, [onFailure, props.src]);
  return <img {...props} alt={props.alt ?? ""} title={imageTitle(props.alt, props.title, props["data-image-role"] === "decorative")} ref={imageRef} onError={onFailure} />;
}
