import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "וי פור ויקיישן",
    short_name: "VII",
    description: "נופש, אירועים, ספא וחוויות בישראל, עם מידע שמאפשר לבחור נכון.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone"],
    background_color: "#ffffff",
    theme_color: "#087e8b",
    lang: "he",
    dir: "rtl",
    categories: ["travel", "lifestyle"],
    icons: [
      { src: "/vii-app-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/vii-app-icon-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "חיפוש נופש", short_name: "נופש", url: "/search" },
      { name: "חיפוש ספא", short_name: "ספא", url: "/spas" },
      { name: "חיפוש אירועים", short_name: "אירועים", url: "/events" },
    ],
  };
}
