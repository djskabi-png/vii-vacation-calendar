import type { Metadata } from "next";
import LegacyDiscoveryPlaceRedirect from "./legacy-place-redirect";

export const metadata: Metadata = {
  title: "וי פור ויקיישן",
  robots: { index: false, follow: true },
};

export default function Page() {
  return <LegacyDiscoveryPlaceRedirect />;
}
