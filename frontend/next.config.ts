import type { NextConfig } from "next";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() ?? "";
const isTauri = process.env.IS_TAURI === "true";

const nextConfig: NextConfig = {
  ...(basePath ? { basePath } : {}),
  output: isTauri ? "export" : "standalone",
  ...(isTauri ? { images: { unoptimized: true } } : {}),
};

export default nextConfig;
