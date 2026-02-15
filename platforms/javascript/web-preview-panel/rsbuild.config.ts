import type { RsbuildConfig } from '@rsbuild/core'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/* eslint-disable @typescript-eslint/naming-convention -- standardized var names */
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
/* eslint-enable @typescript-eslint/naming-convention -- standardized var names */

const env = {
  PUBLIC_CONTENTFUL_TOKEN: process.env.PUBLIC_CONTENTFUL_TOKEN ?? '',
  PUBLIC_CONTENTFUL_ENVIRONMENT: process.env.PUBLIC_CONTENTFUL_ENVIRONMENT ?? '',
  PUBLIC_CONTENTFUL_SPACE_ID: process.env.PUBLIC_CONTENTFUL_SPACE_ID ?? '',
  PUBLIC_CONTENTFUL_CDA_HOST: process.env.PUBLIC_CONTENTFUL_CDA_HOST ?? '',
  PUBLIC_CONTENTFUL_BASE_PATH: process.env.PUBLIC_CONTENTFUL_BASE_PATH ?? '',
  PUBLIC_NINETAILED_CLIENT_ID: process.env.PUBLIC_NINETAILED_CLIENT_ID ?? '',
  PUBLIC_NINETAILED_ENVIRONMENT: process.env.PUBLIC_NINETAILED_ENVIRONMENT ?? '',
  PUBLIC_INSIGHTS_API_BASE_URL: process.env.PUBLIC_INSIGHTS_API_BASE_URL ?? '',
  PUBLIC_EXPERIENCE_API_BASE_URL: process.env.PUBLIC_EXPERIENCE_API_BASE_URL ?? '',
} as const

const config: RsbuildConfig = {
  source: {
    entry: {
      index: './src/dev.ts',
    },
    tsconfigPath: './tsconfig.json',
    define: {
      __OPTIMIZATION_VERSION__: JSON.stringify(process.env.RELEASE_VERSION ?? '0.0.0'),
      __OPTIMIZATION_PACKAGE_NAME__: JSON.stringify('@contentful/optimization-web'),
    },
  },

  resolve: {
    alias: {
      '@contentful/optimization-api-client': path.resolve(
        __dirname,
        '../../../universal/api-client/src/',
      ),
      '@contentful/optimization-api-schemas': path.resolve(
        __dirname,
        '../../../universal/api-schemas/src/',
      ),
      '@contentful/optimization-core': path.resolve(__dirname, '../../../universal/core/src/'),
      '@contentful/optimization-web': path.resolve(__dirname, '../web/src/'),
    },
  },

  html: {
    template: './index.html',
    templateParameters: env,
  },

  output: {
    target: 'web',
  },
}

export default config
