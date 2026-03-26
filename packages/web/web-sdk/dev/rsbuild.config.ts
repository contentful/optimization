import { defineConfig } from '@rsbuild/core'
import { getPackageName } from 'build-tools'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/* eslint-disable @typescript-eslint/naming-convention -- standardized var names */
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const packageRoot = path.resolve(__dirname, '..')
const packageName = getPackageName(packageRoot, '@contentful/optimization-web')
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

export default defineConfig({
  source: {
    entry: {
      index: path.resolve(packageRoot, 'dev/main.ts'),
    },
    tsconfigPath: path.resolve(packageRoot, 'tsconfig.json'),
    define: {
      __OPTIMIZATION_VERSION__: JSON.stringify(process.env.RELEASE_VERSION ?? '0.0.0'),
      __OPTIMIZATION_PACKAGE_NAME__: JSON.stringify(packageName),
    },
  },

  resolve: {
    alias: {
      '@contentful/optimization-api-client': path.resolve(
        packageRoot,
        '../../universal/api-client/src/',
      ),
      '@contentful/optimization-api-schemas': path.resolve(
        packageRoot,
        '../../universal/api-schemas/src/',
      ),
      '@contentful/optimization-core': path.resolve(packageRoot, '../../universal/core-sdk/src/'),
    },
  },

  html: {
    template: path.resolve(packageRoot, 'dev/index.html'),
    templateParameters: env,
  },

  output: {
    target: 'web',
  },
})
