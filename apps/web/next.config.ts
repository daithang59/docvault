import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/security/security-headers";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dirname, '../..');
const webNodeModules = path.join(dirname, 'node_modules');

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  turbopack: {
    root: repoRoot,
    resolveAlias: {
      '@tailwindcss/postcss': path.join(
        webNodeModules,
        '@tailwindcss/postcss',
      ),
      next: path.join(webNodeModules, 'next'),
      tailwindcss: path.join(webNodeModules, 'tailwindcss'),
    },
  },
  async headers() {
    return [
      {
        source: '/robots.txt',
        headers: [
          ...securityHeaders,
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400',
          },
        ],
      },
      {
        source: '/sitemap.xml',
        headers: [
          ...securityHeaders,
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400',
          },
        ],
      },
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
