"use client";

import { useEffect, useRef, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";

type ActiveDrag = {
  pointerId: number;
  pointerType: string;
  startX: number;
  startScrollLeft: number;
  moved: boolean;
};

export function HorizontalChipRail({ className, labels, ariaLabel }: { className: string; labels: string[]; ariaLabel: string }) {
  const railRef = useRef<HTMLDivElement>(null);
  const activeDrag = useRef<ActiveDrag | null>(null);
  const suppressNextClick = useRef(false);
  const suppressionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (suppressionTimer.current) clearTimeout(suppressionTimer.current);
  }, []);

  function beginDrag(event: PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || event.button !== 0) return;
    activeDrag.current = {
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      startX: event.clientX,
      startScrollLeft: event.currentTarget.scrollLeft,
      moved: false,
    };
    if (event.pointerType === "mouse" || event.pointerType === "pen") event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    const drag = activeDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const distance = event.clientX - drag.startX;
    if (!drag.moved && Math.abs(distance) < 5) return;
    drag.moved = true;
    event.currentTarget.dataset.dragging = "true";
    if (drag.pointerType === "mouse" || drag.pointerType === "pen") {
      event.preventDefault();
      event.currentTarget.scrollLeft = drag.startScrollLeft - distance;
    }
  }

  function finishDrag(event: PointerEvent<HTMLDivElement>) {
    const drag = activeDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    delete event.currentTarget.dataset.dragging;
    activeDrag.current = null;
    if (!drag.moved) return;
    suppressNextClick.current = true;
    if (suppressionTimer.current) clearTimeout(suppressionTimer.current);
    suppressionTimer.current = setTimeout(() => {
      suppressNextClick.current = false;
      suppressionTimer.current = null;
    }, 350);
  }

  function suppressDraggedClick(event: MouseEvent<HTMLDivElement>) {
    if (!suppressNextClick.current) return;
    event.preventDefault();
    event.stopPropagation();
    suppressNextClick.current = false;
  }

  function moveWithKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const direction = event.key === "ArrowLeft" ? -1 : 1;
    event.currentTarget.scrollBy({ left: direction * Math.max(120, event.currentTarget.clientWidth * .7), behavior: "smooth" });
  }

  return <div
    ref={railRef}
    className={`${className} horizontal-chip-rail`}
    role="region"
    tabIndex={0}
    aria-label={ariaLabel}
    data-horizontal-rail
    onPointerDown={beginDrag}
    onPointerMove={moveDrag}
    onPointerUp={finishDrag}
    onPointerCancel={finishDrag}
    onClickCapture={suppressDraggedClick}
    onKeyDown={moveWithKeyboard}
  >{labels.map((label) => <span key={label}>{label}</span>)}</div>;
}
