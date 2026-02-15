import { defineConfig } from '@rslib/core'
import { ensureUmdDefaultExport, getPackageName, maybeEnableRsDoctor } from 'build-tools'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/* eslint-disable @typescript-eslint/naming-convention -- standardized var names */
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const packageName = getPackageName(__dirname, '@contentful/optimization-web')
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
      '@contentful/optimization-core': path.resolve(__dirname, '../../../universal/core/src/'),
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

    {
      ...common,
      format: 'umd',
      autoExternal: false,
      umdName: 'Optimization',
      source: {
        entry: {
          'contentful-optimization-web.umd': './src/Optimization.ts',
        },
      },
      output: {
        distPath: { root: 'dist' },
        filename: { js: '[name].js' },
        sourceMap: true,
        cleanDistPath: false,
        minify: true,
      },
      dts: false,
      tools: {
        rspack: (config) => {
          ensureUmdDefaultExport(config)
          maybeEnableRsDoctor(config)
        },
      },
    },
  ],
})
