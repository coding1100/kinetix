import type { NextConfig } from "next";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() ?? "";
const targetApi = process.env.NEXT_PUBLIC_API_URL?.startsWith("http")
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
