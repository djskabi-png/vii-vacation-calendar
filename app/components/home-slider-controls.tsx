"use client";

import { SliderRailControls } from "./slider-rail-controls";

export function HomeSliderControls({
  railId,
  label,
  itemSelector = ":scope > *",
  disabled = false,
}: {
  railId: string;
  label: string;
  itemSelector?: string;
  disabled?: boolean;
}) {
  return <SliderRailControls railId={railId} label={label} itemSelector={itemSelector} disabled={disabled} className="home-slider__controls" />;
}
