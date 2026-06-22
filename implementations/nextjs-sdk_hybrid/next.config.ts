import type { NextConfig } from 'next'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const configDir = dirname(fileURLToPath(import.meta.url))

const nextConfig: NextConfig = {
  env: {
    PUBLIC_APP_ENVIRONMENT: process.env.PUBLIC_APP_ENVIRONMENT,
    PUBLIC_NINETAILED_CLIENT_ID: process.env.PUBLIC_NINETAILED_CLIENT_ID,
    PUBLIC_NINETAILED_ENVIRONMENT: process.env.PUBLIC_NINETAILED_ENVIRONMENT,
    PUBLIC_EXPERIENCE_API_BASE_URL: process.env.PUBLIC_EXPERIENCE_API_BASE_URL,
    PUBLIC_INSIGHTS_API_BASE_URL: process.env.PUBLIC_INSIGHTS_API_BASE_URL,
    PUBLIC_CONTENTFUL_TOKEN: process.env.PUBLIC_CONTENTFUL_TOKEN,
    PUBLIC_CONTENTFUL_PREVIEW_TOKEN: process.env.PUBLIC_CONTENTFUL_PREVIEW_TOKEN,
    PUBLIC_CONTENTFUL_ENVIRONMENT: process.env.PUBLIC_CONTENTFUL_ENVIRONMENT,
    PUBLIC_CONTENTFUL_SPACE_ID: process.env.PUBLIC_CONTENTFUL_SPACE_ID,
    PUBLIC_CONTENTFUL_CDA_HOST: process.env.PUBLIC_CONTENTFUL_CDA_HOST,
    PUBLIC_CONTENTFUL_BASE_PATH: process.env.PUBLIC_CONTENTFUL_BASE_PATH,
    VERCEL_ENV: process.env.VERCEL_ENV,
  },
  turbopack: {
    root: configDir,
  },
}

export default nextConfig
