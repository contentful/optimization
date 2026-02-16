import { defineConfig } from '@rslib/core'
import { getPackageName } from 'build-tools'
import path from 'node:path'

const packageName = getPackageName(__dirname, '@contentful/optimization-react-native')
const workspaceRoot = path.resolve(__dirname, '../../..')
const browserDiaryEntry = path.resolve(
  workspaceRoot,
  'node_modules/.pnpm/node_modules/diary/browser.js',
)
const browserUtilEntry = path.resolve(workspaceRoot, 'node_modules/.pnpm/node_modules/util/util.js')

const runtimeExternals = [
  /^react$/,
  /^react\/jsx-runtime$/,
  /^react\/jsx-dev-runtime$/,
  /^react-native$/,
  /^@react-native-async-storage\/async-storage$/,
  /^@react-native-community\/netinfo$/,
  /^@react-native-clipboard\/clipboard$/,
] as const

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value)
}

function keepReactNativeRuntimeExternals(config: { externals?: unknown }): void {
  const existingExternals = isUnknownArray(config.externals)
    ? config.externals
    : config.externals
      ? [config.externals]
      : []

  config.externals = [...existingExternals, ...runtimeExternals]
}

const common = {
  bundle: true,
  autoExtension: false,
  autoExternal: {
    dependencies: false,
    peerDependencies: true,
    optionalDependencies: true,
    devDependencies: false,
  },
} as const

export default defineConfig({
  source: {
    tsconfigPath: './tsconfig.build.json',
    decorators: { version: '2022-03' }, // stage-3 decorators
    define: {
      __OPTIMIZATION_VERSION__: JSON.stringify(process.env.RELEASE_VERSION ?? '0.0.0'),
      __OPTIMIZATION_PACKAGE_NAME__: JSON.stringify(packageName),
    },
  },
  output: {
    target: 'web',
  },
  resolve: {
    alias: {
      diary$: browserDiaryEntry,
      util$: browserUtilEntry,
    },
  },

  lib: [
    {
      ...common,
      format: 'esm',
      experiments: { advancedEsm: false },
      output: {
        distPath: { root: 'dist' },
        filename: { js: '[name].mjs' },
        sourceMap: true,
        cleanDistPath: true,
      },

      dts: {
        bundle: true,
        build: false,
      },

      redirect: {
        dts: { path: false },
      },
      tools: {
        rspack: keepReactNativeRuntimeExternals,
      },
    },

    {
      ...common,
      format: 'cjs',
      dts: false,
      output: {
        distPath: { root: 'dist' },
        filename: { js: '[name].cjs' },
        sourceMap: true,
        cleanDistPath: false,
      },
      tools: {
        rspack: keepReactNativeRuntimeExternals,
      },
    },
  ],
})
