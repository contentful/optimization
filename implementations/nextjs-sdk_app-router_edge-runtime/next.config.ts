import type { NextConfig } from 'next'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const configDir = dirname(fileURLToPath(import.meta.url))

const nextConfig: NextConfig = {
  transpilePackages: ['e2e-web'],
  env: {
    PUBLIC_NINETAILED_CLIENT_ID: process.env.PUBLIC_NINETAILED_CLIENT_ID,
    PUBLIC_NINETAILED_ENVIRONMENT: process.env.PUBLIC_NINETAILED_ENVIRONMENT,
    PUBLIC_EXPERIENCE_API_BASE_URL: process.env.PUBLIC_EXPERIENCE_API_BASE_URL,
    PUBLIC_INSIGHTS_API_BASE_URL: process.env.PUBLIC_INSIGHTS_API_BASE_URL,
  },
  turbopack: {
    root: configDir,
  },
}

export default nextConfig
