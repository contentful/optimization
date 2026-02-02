import { defineConfig } from '@rslib/core'

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
    decorators: { version: '2022-03' }, // stage-3 decorators
    define: {
      __OPTIMIZATION_VERSION__: JSON.stringify(process.env.RELEASE_VERSION ?? '0.0.0'),
    },
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
    },
  ],
})
