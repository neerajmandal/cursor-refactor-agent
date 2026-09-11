import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@cursor/sdk"],
  allowedDevOrigins: ["10.0.0.58", "127.0.0.1"],
};

export default nextConfig;
