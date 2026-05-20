import { defineConfig } from '@rslib/core'
import { ensureUmdDefaultExport } from 'build-tools'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/* eslint-disable @typescript-eslint/naming-convention -- standardized var names */
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
/* eslint-enable @typescript-eslint/naming-convention -- standardized var names */

const optimizationVersion = JSON.stringify(process.env.RELEASE_VERSION ?? '0.0.0')

// One shared bridge source compiles to a UMD bundle per native platform. The two
// bundles are identical apart from __OPTIMIZATION_PACKAGE_NAME__, which Core stamps
// into the analytics `library.name` field — kept platform-specific so iOS and
// Android events stay distinguishable downstream.
const commonLib = {
  bundle: true,
  autoExtension: false,
  autoExternal: false,
  format: 'umd',
  umdName: 'OptimizationBridge',
  dts: false,
} as const

const commonOutput = {
  distPath: { root: 'dist' },
  filename: { js: '[name].js' },
  sourceMap: true,
  cleanDistPath: false,
  minify: true,
} as const

export default defineConfig({
  source: {
    tsconfigPath: './tsconfig.build.json',
  },

  resolve: {
    alias: {
      '@contentful/optimization-api-client': path.resolve(__dirname, '../api-client/src/'),
      '@contentful/optimization-api-schemas': path.resolve(__dirname, '../api-schemas/src/'),
      '@contentful/optimization-core': path.resolve(__dirname, '../core-sdk/src/'),
    },
  },

  output: {
    target: 'web',
  },

  lib: [
    {
      ...commonLib,
      source: {
        entry: {
          'optimization-ios-bridge.umd': './src/index.ts',
        },
        define: {
          __OPTIMIZATION_VERSION__: optimizationVersion,
          __OPTIMIZATION_PACKAGE_NAME__: JSON.stringify('@contentful/optimization-ios-bridge'),
        },
      },
      output: { ...commonOutput },
      tools: {
        rspack: (config) => {
          ensureUmdDefaultExport(config)
        },
      },
    },
    {
      ...commonLib,
      source: {
        entry: {
          'optimization-android-bridge.umd': './src/index.ts',
        },
        define: {
          __OPTIMIZATION_VERSION__: optimizationVersion,
          __OPTIMIZATION_PACKAGE_NAME__: JSON.stringify('@contentful/optimization-android-bridge'),
        },
      },
      output: { ...commonOutput },
      tools: {
        rspack: (config) => {
          ensureUmdDefaultExport(config)
        },
      },
    },
  ],
})
