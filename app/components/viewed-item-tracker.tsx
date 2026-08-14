"use client";

import { useEffect } from "react";
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
  useEffect(() => {
    rememberViewedItem({ id, world, name, location, image, href, meta });
  }, [href, id, image, location, meta, name, world]);

  return null;
}
