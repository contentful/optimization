import { RsdoctorRspackPlugin } from '@rsdoctor/rspack-plugin'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { isRecord } from './typeGuards'

/**
 * Conditionally adds the Rsdoctor Rspack plugin to the build config when the
 * `RSDOCTOR` environment variable is set to `"true"`.
 *
 * @param config - The Rslib/Rspack configuration object to mutate.
 * @returns Nothing.
 *
 * @example
 * ```typescript
 * import { maybeEnableRsDoctor } from 'build-tools'
 *
 * const config = { plugins: [], output: {}, devtool: 'source-map' }
 * maybeEnableRsDoctor(config)
 * ```
 *
 * @public
 */
export const maybeEnableRsDoctor = (config: {
  plugins?: unknown
  output?: unknown
  devtool?: unknown
}): void => {
  if (process.env.RSDOCTOR !== 'true') {
    return
  }

  if (!Array.isArray(config.plugins)) {
    return
  }

  config.plugins.push(
    new RsdoctorRspackPlugin({
      disableClientServer: true,
      // Keep output deterministic and local to the package.
      output: {
        reportDir: './',
      },
    }),
  )
}

/**
 * Ensures a UMD library config exposes the default export directly on the
 * global object by setting `library.export` to `'default'`.
 *
 * @param config - The Rslib/Rspack configuration object to mutate.
 * @returns Nothing.
 *
 * @example
 * ```typescript
 * import { ensureUmdDefaultExport } from 'build-tools'
 *
 * const config = { output: { library: { type: 'umd' } } }
 * ensureUmdDefaultExport(config)
 * ```
 *
 * @public
 */
export const ensureUmdDefaultExport = (config: { output?: unknown }): void => {
  const { output } = config

  if (!isRecord(output)) {
    return
  }

  const { library } = output

  if (!isRecord(library)) {
    return
  }

  const { type } = library

  if (type !== 'umd') {
    return
  }

  // Expose the default export directly on the UMD global.
  library.export = 'default'
}

/**
 * Reads polyfill `.js` files from `dir` in the order specified and concatenates
 * their contents into a single string suitable for use as an
 * `rspack.BannerPlugin` `banner` value. The text is meant to be emitted before
 * the UMD IIFE so top-level `var` / `function` declarations bind on the global
 * object when evaluated by JavaScriptCore or QuickJS. Files are joined with
 * `\n;\n` to defend against ASI hazards between adjacent scripts.
 *
 * @param dir - Absolute path to the directory holding the polyfill `.js` files.
 * @param fileNames - Polyfill basenames (without `.js`) in evaluation order.
 * @returns Concatenated polyfill source.
 *
 * @public
 */
export const concatPolyfills = (dir: string, fileNames: readonly string[]): string =>
  fileNames.map((name) => readFileSync(path.join(dir, `${name}.js`), 'utf8')).join('\n;\n')
