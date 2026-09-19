import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // snowflake-sdk and @react-pdf/renderer are Node-only; keep them out of the bundle.
  serverExternalPackages: ["snowflake-sdk", "@react-pdf/renderer"],
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
};

export default nextConfig;
