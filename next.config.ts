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
};

export default nextConfig;
