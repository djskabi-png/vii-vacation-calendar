"use client";

/* eslint-disable @next/next/no-img-element */

import { useLayoutEffect, useRef, type ImgHTMLAttributes } from "react";

export function ResilientImage({ onFailure, ...props }: ImgHTMLAttributes<HTMLImageElement> & { src: string; onFailure: () => void }) {
  const imageRef = useRef<HTMLImageElement>(null);
  useLayoutEffect(() => {
    const image = imageRef.current;
    // The request may fail before hydration attaches onError. The decoded
    // state is therefore part of the contract, not just the error event.
    if (image?.complete && image.naturalWidth === 0) onFailure();
  }, [onFailure, props.src]);
  return <img {...props} ref={imageRef} onError={onFailure} />;
}
