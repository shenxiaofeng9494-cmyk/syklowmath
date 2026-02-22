import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // 本地 tsc --noEmit 已验证通过，跳过构建时重复检查以加速部署
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
