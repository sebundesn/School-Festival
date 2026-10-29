import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // S3 + CloudFront で配信する静的ビルド (out/)
  output: "export",
};

export default nextConfig;
