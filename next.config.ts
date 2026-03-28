import type { NextConfig } from "next";

const repoName = "Thasyu-create";
const isGitHubPagesBuild = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = {
  output: isGitHubPagesBuild ? "export" : undefined,
  images: {
    unoptimized: true,
  },
  allowedDevOrigins:
    process.env.NODE_ENV === "development"
      ? ["192.168.56.1", "http://192.168.56.1:3000", "http://192.168.56.1:3001"]
      : undefined,
  trailingSlash: true,
  basePath: process.env.NODE_ENV === "production" ? `/${repoName}` : "",
  assetPrefix: process.env.NODE_ENV === "production" ? `/${repoName}/` : undefined,
};

export default nextConfig;
