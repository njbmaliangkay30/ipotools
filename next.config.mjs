/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['playwright'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
