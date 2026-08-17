import type { NextConfig } from "next";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() ?? "";
const isTauri = process.env.IS_TAURI === "true";

const targetApi = process.env.NEXT_PUBLIC_API_URL?.startsWith("http")
  ? new URL(process.env.NEXT_PUBLIC_API_URL).origin
  : "https://kinetix.mindrind.com";

const nextConfig: NextConfig = {
  ...(basePath ? { basePath } : {}),
  output: isTauri ? "export" : "standalone",
  ...(isTauri ? { images: { unoptimized: true } } : {}),
  ...(!isTauri
    ? {
        async rewrites() {
          return [
            {
              source: "/api/v1/:path*",
              destination: `${targetApi}/api/v1/:path*`,
            },
          ];
        },
      }
    : {}),
};

export default nextConfig;
