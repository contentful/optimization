import { RsdoctorRspackPlugin } from '@rsdoctor/rspack-plugin'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

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
        reportDir: 'coverage',
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
