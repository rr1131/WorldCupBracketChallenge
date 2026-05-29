import type { NextConfig } from "next";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() || undefined;

const nextConfig: NextConfig = {
  basePath,
};

export default nextConfig;
