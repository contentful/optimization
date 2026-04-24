import { defineConfig } from '@rslib/core'
import { ensureUmdDefaultExport, getPackageName } from 'build-tools'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/* eslint-disable @typescript-eslint/naming-convention -- standardized var names */
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const packageName = getPackageName(__dirname, '@contentful/optimization-ios-bridge')
/* eslint-enable @typescript-eslint/naming-convention -- standardized var names */

export default defineConfig({
  source: {
    tsconfigPath: './tsconfig.build.json',
    define: {
      __OPTIMIZATION_VERSION__: JSON.stringify(process.env.RELEASE_VERSION ?? '0.0.0'),
      __OPTIMIZATION_PACKAGE_NAME__: JSON.stringify(packageName),
    },
  },

  resolve: {
    alias: {
      '@contentful/optimization-api-client': path.resolve(
        __dirname,
        '../../universal/api-client/src/',
      ),
      '@contentful/optimization-api-schemas': path.resolve(
        __dirname,
        '../../universal/api-schemas/src/',
      ),
      '@contentful/optimization-core': path.resolve(__dirname, '../../universal/core-sdk/src/'),
      '@contentful/optimization-preview': path.resolve(
        __dirname,
        '../../universal/preview-sdk/src/',
      ),
    },
  },

  output: {
    target: 'web',
  },

  lib: [
    {
      bundle: true,
      autoExtension: false,
      autoExternal: false,
      format: 'umd',
      umdName: 'OptimizationBridge',
      source: {
        entry: {
          'optimization-ios-bridge.umd': './src/index.ts',
        },
      },
      output: {
        distPath: { root: 'dist' },
        filename: { js: '[name].js' },
        sourceMap: true,
        cleanDistPath: true,
        minify: true,
      },
      dts: false,
      tools: {
        rspack: (config) => {
          ensureUmdDefaultExport(config)
        },
      },
    },
  ],
})
