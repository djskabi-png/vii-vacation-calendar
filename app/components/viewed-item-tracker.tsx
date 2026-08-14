"use client";

import { useLayoutEffect } from "react";
import type { SavedWorld } from "../lib/saved-items";
import { rememberViewedItem } from "../lib/viewed-items";

type Props = {
  id: string;
  world: SavedWorld;
  name: string;
  location: string;
  image?: string;
  href: string;
  meta?: string;
};

export function ViewedItemTracker({ id, world, name, location, image, href, meta }: Props) {
  useLayoutEffect(() => {
    const remember = () => rememberViewedItem({ id, world, name, location, image, href, meta });
    remember();
    window.addEventListener("pageshow", remember);
    return () => window.removeEventListener("pageshow", remember);
  }, [href, id, image, location, meta, name, world]);

  return null;
}
