import type { NextConfig } from "next";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() ?? "";
const targetApi = process.env.INTERNAL_API_URL?.trim()
  ? process.env.INTERNAL_API_URL.trim()
  : process.env.NEXT_PUBLIC_API_URL?.startsWith("http")
  ? new URL(process.env.NEXT_PUBLIC_API_URL).origin
  : "https://kinetix.mindrind.com";

const nextConfig: NextConfig = {
  ...(basePath ? { basePath } : {}),
  // The Tauri bundle loads the deployed Kinetix frontend (tauri.conf.json),
  // so it uses the same runtime routes as web rather than a static export.
  output: "standalone",
  async headers() {
    return [
      {
        source: "/version.json",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
      // HTML documents must always revalidate. Without this, Next.js serves
      // prerendered pages with `s-maxage=31536000` (a year), so the desktop
      // app's WebView2 can pin the app shell - and the hashed JS bundle URLs
      // it references - effectively forever, leaving users on stale code
      // long after a deploy. The /_next/static assets below are content-
      // hashed so they stay immutable; it's only the shell that must be
      // re-fetched to learn about new hashes.
      {
        source: "/:path*",
        missing: [{ type: "header", key: "next-router-prefetch" }],
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, must-revalidate",
          },
        ],
      },
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${targetApi}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
