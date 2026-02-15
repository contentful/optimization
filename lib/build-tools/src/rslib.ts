import { RsdoctorRspackPlugin } from '@rsdoctor/rspack-plugin'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

export const maybeEnableRsDoctor = (config: { plugins?: unknown }): void => {
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
        reportDir: '.rsdoctor',
      },
    }),
  )
}

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
