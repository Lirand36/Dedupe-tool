import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@dedupe/core", "@dedupe/cli"],
  serverExternalPackages: ["@electric-sql/pglite"],
  // Type checking runs in CI via the repo-wide `tsc`, which uses the same strict settings.
  typescript: { ignoreBuildErrors: true },
  experimental: { serverActions: { bodySizeLimit: "25mb" } },
};

export default config;
