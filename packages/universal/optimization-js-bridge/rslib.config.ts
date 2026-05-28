import { defineConfig } from '@rslib/core'
import { concatPolyfills, ensureUmdDefaultExport } from 'build-tools'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/* eslint-disable @typescript-eslint/naming-convention -- standardized var names */
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
/* eslint-enable @typescript-eslint/naming-convention -- standardized var names */

const optimizationVersion = JSON.stringify(process.env.RELEASE_VERSION ?? '0.0.0')

// Evaluation order is load-bearing: `timers` must precede `abort-controller`,
// and `console` is first so anything that logs during its own initialization
// can do so. Mirrors the order the per-platform PolyfillScriptLoader files
// previously used.
const POLYFILL_LOAD_ORDER = [
  'console',
  'timers',
  'fetch',
  'crypto',
  'url',
  'abort-controller',
  'promise-utilities',
  'text-encoding',
] as const

const polyfillBanner = concatPolyfills(
  path.resolve(__dirname, './src/polyfills'),
  POLYFILL_LOAD_ORDER,
)

/**
 * Prepends the polyfill source verbatim to each emitted `.js` asset. A custom
 * plugin is used instead of `rspack.BannerPlugin` because BannerPlugin runs
 * `[id]` / `[name]` / `[hash]` template substitution on the banner text, which
 * silently rewrites property accesses like `__timerCallbacks[id]` inside the
 * timers polyfill to the chunk id.
 */
const polyfillPrependPlugin = {
  apply(compiler: import('@rslib/core').Rspack.Compiler) {
    compiler.hooks.thisCompilation.tap('PolyfillPrependPlugin', (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: 'PolyfillPrependPlugin',
          stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONS,
        },
        (assets) => {
          for (const filename of Object.keys(assets)) {
            if (!filename.endsWith('.js')) continue
            compilation.updateAsset(
              filename,
              (old) => new compiler.webpack.sources.ConcatSource(polyfillBanner, '\n;\n', old),
            )
          }
        },
      )
    })
  },
}

const prependPolyfillSource = (config: { plugins?: unknown }): void => {
  if (!Array.isArray(config.plugins)) {
    config.plugins = []
  }
  ;(config.plugins as unknown[]).push(polyfillPrependPlugin)
}

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
          prependPolyfillSource(config)
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
          prependPolyfillSource(config)
        },
      },
    },
  ],
})
