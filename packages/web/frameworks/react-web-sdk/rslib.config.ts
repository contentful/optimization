import { pluginReact } from '@rsbuild/plugin-react'
import { defineConfig } from '@rslib/core'
import { getPackageName, getPackageVersion, maybeEnableRsDoctor } from 'build-tools'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/* eslint-disable @typescript-eslint/naming-convention -- standardized var names */
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const packageName = getPackageName(__dirname, '@contentful/optimization-react-web')
const packageVersion = getPackageVersion(__dirname, '0.0.0')
/* eslint-enable @typescript-eslint/naming-convention -- standardized var names */

const common = {
  bundle: true,
  autoExtension: false,
  autoExternal: {
    dependencies: true,
    peerDependencies: true,
    optionalDependencies: true,
    devDependencies: false,
  },
} as const

const CLIENT_DIRECTIVE = "'use client';"

const reactClientEntries = {
  index: './src/index.ts',
  'router/next-app': './src/router/next-app.tsx',
  'router/next-pages': './src/router/next-pages.tsx',
  'router/react-router': './src/router/react-router.tsx',
  'router/tanstack-router': './src/router/tanstack-router.tsx',
} as const

const supportEntries = {
  logger: './src/logger.ts',
  'web-sdk': './src/web-sdk.ts',
  'core-sdk': './src/core-sdk.ts',
  'api-client': './src/api-client.ts',
  'api-schemas': './src/api-schemas.ts',
} as const

const esmOutput = {
  distPath: { root: 'dist' },
  filename: { js: '[name].mjs' },
  sourceMap: true,
  minify: true,
} as const

const cjsOutput = {
  distPath: { root: 'dist' },
  filename: { js: '[name].cjs' },
  sourceMap: true,
  cleanDistPath: false,
  minify: true,
} as const

const bundledDts = {
  bundle: true,
  build: false,
} as const

export default defineConfig({
  plugins: [pluginReact()],
  source: {
    tsconfigPath: './tsconfig.build.json',
    define: {
      __OPTIMIZATION_VERSION__: JSON.stringify(process.env.RELEASE_VERSION ?? packageVersion),
      __OPTIMIZATION_PACKAGE_NAME__: JSON.stringify(packageName),
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
      '@contentful/optimization-core': path.resolve(__dirname, '../../../universal/core-sdk/src/'),
      '@contentful/optimization-web': path.resolve(__dirname, '../../web-sdk/src/'),
    },
  },
  output: {
    target: 'web',
  },
  lib: [
    {
      ...common,
      format: 'esm',
      banner: { js: CLIENT_DIRECTIVE },
      source: {
        entry: reactClientEntries,
      },
      output: {
        ...esmOutput,
        cleanDistPath: true,
      },
      dts: bundledDts,
      redirect: {
        dts: { path: false },
      },
      tools: {
        rspack: maybeEnableRsDoctor,
      },
    },
    {
      ...common,
      format: 'esm',
      source: {
        entry: supportEntries,
      },
      output: {
        ...esmOutput,
        cleanDistPath: false,
      },
      dts: bundledDts,
      redirect: {
        dts: { path: false },
      },
      tools: {
        rspack: maybeEnableRsDoctor,
      },
    },
    {
      ...common,
      format: 'cjs',
      banner: { js: CLIENT_DIRECTIVE },
      source: {
        entry: reactClientEntries,
      },
      output: cjsOutput,
      dts: false,
      tools: {
        rspack: maybeEnableRsDoctor,
      },
    },
    {
      ...common,
      format: 'cjs',
      source: {
        entry: supportEntries,
      },
      output: cjsOutput,
      dts: false,
      tools: {
        rspack: maybeEnableRsDoctor,
      },
    },
  ],
})
