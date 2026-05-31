import type { NextConfig } from "next";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() || undefined;
const apiUpstream =
  process.env.API_UPSTREAM_URL?.trim() || process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "";

function normalizeUpstream(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

const nextConfig: NextConfig = {
  basePath,
  async rewrites() {
    if (!apiUpstream) {
      return [];
    }

    return [
      {
        source: "/api/:path*",
        destination: `${normalizeUpstream(apiUpstream)}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
