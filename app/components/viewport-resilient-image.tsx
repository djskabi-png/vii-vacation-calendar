"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState, type ComponentProps } from "react";
import { ResilientImage } from "./resilient-image";
import { observeSectionActivation } from "../lib/section-activation";

/** Room photos keep their full source and failure handling, but do not compete
 * with the hero while they are several screens below the visitor. */
export function ViewportResilientImage(props: ComponentProps<typeof ResilientImage>) {
  const [active, setActive] = useState(false);
  const placeholder = useRef<HTMLImageElement>(null);
  useEffect(() => {
    if (active) return;
    const image = placeholder.current;
    if (!image) { setActive(true); return; }
    return observeSectionActivation(image.closest("button") || image, () => setActive(true));
  }, [active]);
  const { src, srcSet, onFailure, style, ...imageProps } = props;
  return <>
    {active ? <ResilientImage {...props} /> : <img {...imageProps} ref={placeholder} alt="" aria-hidden="true" data-vii-room-placeholder="" style={{ ...style, visibility: "hidden" }} />}
    <noscript><style>{"[data-vii-room-placeholder] { display: none !important; }"}</style><img {...imageProps} src={src} srcSet={srcSet} style={style} alt={props.alt ?? ""} /></noscript>
  </>;
}
