import { defineConfig } from '@rslib/core'
import { getPackageName, maybeEnableRsDoctor } from 'build-tools'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/* eslint-disable @typescript-eslint/naming-convention -- standardized var names */
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const packageName = getPackageName(__dirname, '@contentful/optimization-react-web')
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

export default defineConfig({
  source: {
    entry: {
      index: './src/index.ts',
      logger: './src/logger.ts',
      'web-sdk': './src/web-sdk.ts',
      'core-sdk': './src/core-sdk.ts',
      'api-client': './src/api-client.ts',
      'api-schemas': './src/api-schemas.ts',
      'router/next-app': './src/router/next-app.tsx',
      'router/next-pages': './src/router/next-pages.tsx',
      'router/react-router': './src/router/react-router.tsx',
      'router/tanstack-router': './src/router/tanstack-router.tsx',
    },
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
      output: {
        distPath: { root: 'dist' },
        filename: { js: '[name].mjs' },
        sourceMap: true,
        cleanDistPath: true,
        minify: true,
      },
      dts: {
        bundle: true,
        build: false,
      },
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
      output: {
        distPath: { root: 'dist' },
        filename: { js: '[name].cjs' },
        sourceMap: true,
        cleanDistPath: false,
        minify: true,
      },
      dts: false,
      tools: {
        rspack: maybeEnableRsDoctor,
      },
    },
  ],
})
