import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: "export",  // 静的HTMLとして出力
  distDir: "out",    // 出力先ディレクトリを指定
};

export default nextConfig;
