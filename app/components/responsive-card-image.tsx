"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useLayoutEffect, useRef, useState, type ImgHTMLAttributes } from "react";
import { defaultCardImageSizes, isOptimizableCardMedia, responsiveCardMedia } from "../lib/responsive-media";
import { imageTitle } from "../lib/image-metadata";

type ImageMetadataProps = { alt: string; title?: string; "data-image-role"?: "decorative" | "content" };


export function ResponsiveCardImage({
  src,
  sizes = defaultCardImageSizes,
  imageWidths,
  quality = 82,
  onOriginalFailure,
  ...props
}: Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt" | "title"> & ImageMetadataProps & {
  src: string;
  imageWidths?: readonly number[];
  quality?: number;
  onOriginalFailure?: () => void;
}) {
  const [failedOptimizedSource, setFailedOptimizedSource] = useState<string | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const optimizable = isOptimizableCardMedia(src);
  const responsive = responsiveCardMedia(src, quality, imageWidths);
  const useOriginal = failedOptimizedSource === src;

  const recover = useCallback(() => {
    if (optimizable && !useOriginal) {
      setFailedOptimizedSource(src);
      return;
    }
    onOriginalFailure?.();
  }, [onOriginalFailure, optimizable, src, useOriginal]);

  useLayoutEffect(() => {
    const image = imageRef.current;
    // An optimized request can fail before React hydrates the server-rendered
    // image. In that case the browser has already emitted `error`, so inspect
    // the decoded state and still take the one-step original-source fallback.
    if (image?.complete && image.naturalWidth === 0) recover();
  }, [recover]);

  return <img
    {...props}
    ref={imageRef}
    src={useOriginal ? src : responsive.src}
    srcSet={useOriginal ? undefined : responsive.srcSet}
    sizes={!useOriginal && optimizable ? sizes : undefined}
    alt={props.alt ?? ""}
    title={imageTitle(props.alt, props.title, props["data-image-role"] === "decorative")}
    onError={recover}
  />;
}
