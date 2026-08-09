import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_ACTIONS === "true";
const pagesBasePath = "/vii-vacation-calendar";

const nextConfig: NextConfig = {
  output: isGitHubPages ? "export" : undefined,
  basePath: isGitHubPages ? pagesBasePath : undefined,
  assetPrefix: isGitHubPages ? pagesBasePath : undefined,
  trailingSlash: false,
  images: {
    unoptimized: true,
  },
  async redirects() {
    return [
      { source: "/privacy_policy", destination: "/legal/privacy", permanent: true },
      { source: "/term_and_conditions", destination: "/legal/terms", permanent: true },
      { source: "/:locale(en|ru|fr)/privacy_policy", destination: "/:locale/legal/privacy", permanent: true },
      { source: "/:locale(en|ru|fr)/term_and_conditions", destination: "/:locale/legal/terms", permanent: true },
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/:locale(en|ru|fr)", destination: "/" },
        { source: "/:locale(en|ru|fr)/:path*", destination: "/:path*" },
      ],
    };
  },
};

export default nextConfig;
