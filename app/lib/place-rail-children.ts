import { Children, isValidElement, type ReactNode } from "react";
import { orderDiscoveryRail } from "./discovery-slider-order";
import { managedVacationPriority } from "./vacation-priority";

// Opt-in for static place/trail recommendations only. They have no verified
// dated booking badge. Quote-bearing rails order their real data/proof directly.
export function orderPlaceRailChildren(children: ReactNode, seed: string) {
  return orderDiscoveryRail(Children.toArray(children), {
    id: item => isValidElement(item) ? String(item.key) : String(item),
    priority: item => isValidElement<{ property?: { curatedRank?: number } }>(item)
      ? managedVacationPriority(item.props.property?.curatedRank) : undefined,
    seed,
  });
}
