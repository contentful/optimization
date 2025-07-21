// import type { RollupOptions, Plugin, ModuleFormat } from 'rollup'
// import type { PackageJson as BasePackageJson } from 'type-fest'
import commonjs from '@rollup/plugin-commonjs'
// import resolve, { type RollupNodeResolveOptions } from '@rollup/plugin-node-resolve'
import resolve from '@rollup/plugin-node-resolve'
import swc from '@rollup/plugin-swc'
import terser from '@rollup/plugin-terser'
import swcConfig from './swcrc.json' with { type: 'json' }

/* TODO: When Rollup finally decides to handle TS in a sane way, update with commented types */

// export type PackageJson = Omit<BasePackageJson, 'type'> & {
//   browser?: string
//   main?: string
//   module?: string
//   type?: string
// }
//
// interface Opts {
//   format?: ModuleFormat
//   input?: string
//   name?: string
//   pkg: PackageJson
//   resolveOptions?: RollupNodeResolveOptions
// }

// Returns Plugin[]
function plugins({ resolveOptions = {} }) {
  return [
    resolve(resolveOptions),
    commonjs(),
    swc({
      swc: swcConfig,
    }),
    terser(),
  ]
}

// Returns RollupOptions[]
export function main({ pkg, input = 'src/index.ts', resolveOptions = {} }) {
  return {
    input,
    output: { file: pkg.main, format: 'cjs', sourcemap: true },
    plugins: plugins({ resolveOptions }),
    external: [],
  }
}

// Returns RollupOptions[]
export function module({ pkg, input = 'src/index.ts', resolveOptions = {} }) {
  return {
    input,
    output: { file: pkg.module, format: 'es', sourcemap: true },
    plugins: plugins({ resolveOptions }),
  }
}

// Returns RollupOptions[]
export function web({ pkg, name, format = 'iife', input = 'src/index.ts', resolveOptions = {} }) {
  if (!name) throw new Error('Must specify the name of the global variable')

  return {
    input,
    output: {
      name,
      file: pkg.browser,
      format,
      globals: {
        name,
      },
      sourcemap: true,
    },
    plugins: plugins({
      resolveOptions: {
        ...resolveOptions,
        browser: true,
        preferBuiltins: false,
      },
    }),
    external: [],
  }
}

// Returns RollupOptions[]
export function universal(opts) {
  return web({ ...opts, format: 'umd' })
}

const RollupConfig = {
  main,
  module,
  web,
  universal,
}

export default RollupConfig
