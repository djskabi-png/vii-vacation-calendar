"use client";

/* eslint-disable @next/next/no-img-element */

import { useState, type ImgHTMLAttributes } from "react";
import { isOptimizableCardMedia, responsiveCardMedia } from "../lib/responsive-media";

const defaultSizes = "(max-width: 760px) calc(100vw - 32px), (max-width: 1180px) 50vw, 420px";

export function ResponsiveCardImage({
  src,
  sizes = defaultSizes,
  imageWidths,
  quality = 82,
  onOriginalFailure,
  ...props
}: Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src: string;
  imageWidths?: readonly number[];
  quality?: number;
  onOriginalFailure?: () => void;
}) {
  const [failedOptimizedSource, setFailedOptimizedSource] = useState<string | null>(null);
  const optimizable = isOptimizableCardMedia(src);
  const responsive = responsiveCardMedia(src, quality, imageWidths);
  const useOriginal = failedOptimizedSource === src;

  return <img
    {...props}
    src={useOriginal ? src : responsive.src}
    srcSet={useOriginal ? undefined : responsive.srcSet}
    sizes={!useOriginal && optimizable ? sizes : undefined}
    alt={props.alt ?? ""}
    onError={() => {
      if (optimizable && !useOriginal) {
        setFailedOptimizedSource(src);
        return;
      }
      onOriginalFailure?.();
    }}
  />;
}
