/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  serverExternalPackages: ['better-sqlite3'],
  images: {
    unoptimized: true
  }
};

export default nextConfig;
