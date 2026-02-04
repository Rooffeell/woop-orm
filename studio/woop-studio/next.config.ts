import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["pg", "pg-native"],
  typescript: {
    ignoreBuildErrors: true,
  }
};

export default nextConfig;
