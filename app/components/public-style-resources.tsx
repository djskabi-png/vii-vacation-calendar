"use client";

import { usePathname } from 'next/navigation';
import bundles from 'virtual:vii-public-style-bundles';
import { publicStyleWorld } from '../lib/public-style-world';

export function PublicStyleResources({ initialPath }: { initialPath: string }) {
  const pathname = usePathname() || initialPath;
  const href = bundles[publicStyleWorld(pathname)];
  // React owns insertion, de-duplication and the stylesheet readiness boundary.
  // A new resource key is required: React stylesheet props are immutable.
  return <link key={href} rel="stylesheet" href={href} precedence="vii-public" />;
}
