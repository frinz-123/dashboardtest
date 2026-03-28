/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: process.env.NEXT_PUBLIC_ENABLE_REACT_COMPILER === "true",
  reactStrictMode: true,
  env: {
    AUTH_SECRET: process.env.AUTH_SECRET,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    AUTH_URL: process.env.AUTH_URL,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    AUTH_TRUST_HOST: process.env.AUTH_TRUST_HOST,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET,
    OVERRIDE_EMAIL: process.env.OVERRIDE_EMAIL,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts', 'react-aria-components'],
  },
};

export default nextConfig;
