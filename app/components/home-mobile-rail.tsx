import type { ReactNode } from "react";
import { HomeSliderControls } from "./home-slider-controls";

// Keep the established desktop grid. Mobile uses the same bounded controls
// and retains every item rather than truncating the homepage inventory.
export function HomeMobileRail({ id, label, className, children }: {
  id: string; label: string; className: string; children: ReactNode;
}) {
  return <>
    <div className="home-mobile-rail-controls"><HomeSliderControls railId={id} label={label} /></div>
    <div id={id} className={`${className} home-mobile-rail`} data-horizontal-rail aria-label={label}>{children}</div>
  </>;
}
