import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  serverExternalPackages: ['imapflow', 'nodemailer', 'mailparser'],
  // Ensure Prisma client is included in the standalone output
  outputFileTracingIncludes: {
    '/': ['./node_modules/.prisma/**/*', './node_modules/@prisma/client/**/*'],
  },
};

export default nextConfig;
