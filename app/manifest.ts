import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "וי פור ויקיישן",
    short_name: "VII",
    description: "נופש, אירועים, ספא וחוויות בישראל, עם מידע שמאפשר לבחור נכון.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#087e8b",
    lang: "he",
    dir: "rtl",
    icons: [
      { src: "/vii-logo.png", sizes: "160x122", type: "image/png", purpose: "any" },
    ],
  };
}
