import { defineConfig } from '@rslib/core'
import { maybeEnableRsDoctor } from 'build-tools'

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
      'api-schemas': './src/api-schemas.ts',
    },
    tsconfigPath: './tsconfig.build.json',
    decorators: { version: '2022-03' }, // stage-3 decorators
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
      dts: false,
      output: {
        distPath: { root: 'dist' },
        filename: { js: '[name].cjs' },
        sourceMap: true,
        cleanDistPath: false,
      },

      tools: {
        rspack: maybeEnableRsDoctor,
      },
    },
  ],
})
