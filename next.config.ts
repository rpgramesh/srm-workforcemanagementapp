import type { NextConfig } from "next";

const PROJECT_ROOT = process.cwd();

const nextConfig: NextConfig = {
  turbopack: {
    root: PROJECT_ROOT,
  },
};

export default nextConfig;
