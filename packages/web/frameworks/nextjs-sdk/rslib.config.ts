import { pluginReact } from '@rsbuild/plugin-react'
import { defineConfig } from '@rslib/core'
import { getPackageName, maybeEnableRsDoctor } from 'build-tools'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/* eslint-disable @typescript-eslint/naming-convention -- standardized var names */
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const packageName = getPackageName(__dirname, '@contentful/optimization-nextjs')
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

const clientEntries = {
  client: './src/client.ts',
} as const

const serverEntries = {
  index: './src/index.ts',
  'request-handler': './src/request-handler.ts',
  server: './src/server.tsx',
  'tracking-attributes': './src/tracking-attributes.ts',
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
      __OPTIMIZATION_VERSION__: JSON.stringify(process.env.RELEASE_VERSION ?? '0.0.0'),
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
      '@contentful/optimization-node': path.resolve(__dirname, '../../../node/node-sdk/src/'),
      '@contentful/optimization-react-web': path.resolve(__dirname, '../react-web-sdk/src/'),
      '@contentful/optimization-web': path.resolve(__dirname, '../../web-sdk/src/'),
    },
  },
  lib: [
    {
      ...common,
      format: 'esm',
      banner: { js: CLIENT_DIRECTIVE },
      source: {
        entry: clientEntries,
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
        entry: serverEntries,
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
        entry: clientEntries,
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
        entry: serverEntries,
      },
      output: cjsOutput,
      dts: false,
      tools: {
        rspack: maybeEnableRsDoctor,
      },
    },
  ],
})
