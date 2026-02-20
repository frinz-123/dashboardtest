/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: process.env.NEXT_PUBLIC_ENABLE_REACT_COMPILER === "true",
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts', 'react-aria-components'],
  },
};

export default nextConfig;
