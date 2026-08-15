/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['better-sqlite3'],
  images: {
    unoptimized: true
  }
};

export default nextConfig;
