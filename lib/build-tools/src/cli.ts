import { checkBundleSize } from './bundleSize'
import { emitDualDts } from './emitDualDts'

function printUsage(): void {
  process.stderr.write(
    'Usage:\n' +
      '  build-tools emit-dual-dts [distDir]\n' +
      '  build-tools bundle-size [packageDir] [--report-only]\n' +
      '\n' +
      'Examples:\n' +
      '  build-tools emit-dual-dts ./dist\n' +
      '  build-tools bundle-size\n' +
      '  build-tools bundle-size ./packages/web/web-sdk --report-only\n',
  )
}

function parseBundleSizeArgs(
  args: string[],
): { packageDir: string; reportOnly: boolean } | undefined {
  let packageDir = '.'
  let reportOnly = false

  for (const arg of args) {
    if (arg === '--report-only') {
      reportOnly = true
      continue
    }

    if (arg.startsWith('--') || packageDir !== '.') return undefined

    packageDir = arg
  }

  return { packageDir, reportOnly }
}

/**
 * CLI entry point that parses arguments and dispatches to the appropriate command.
 *
 * @param argv - Command-line arguments (excluding the interpreter and script paths).
 * @returns Nothing.
 *
 * @example
 * ```typescript
 * main(['emit-dual-dts', './dist'])
 * ```
 *
 * @public
 */
export function main(argv: string[]): void {
  const [command, ...rest] = argv

  if (command === 'emit-dual-dts') {
    const [distDir = './dist'] = rest
    emitDualDts(distDir)
    return
  }

  if (command === 'bundle-size') {
    const parsed = parseBundleSizeArgs(rest)

    if (parsed === undefined) {
      printUsage()
      process.exitCode = 1
      return
    }

    const { failures, results } = checkBundleSize(parsed)

    for (const result of results) {
      const { budgetBytes, file, gzipBytes, rawBytes } = result
      // eslint-disable-next-line no-console -- this CLI reports bundle stats to CI logs.
      console.log(`${file}: raw=${rawBytes} gzip=${gzipBytes} budget=${budgetBytes}`)
    }

    if (failures.length > 0) {
      // eslint-disable-next-line no-console -- this CLI reports failures to CI logs.
      console.error('Bundle size budget exceeded:')

      for (const failure of failures) {
        // eslint-disable-next-line no-console -- this CLI reports failures to CI logs.
        console.error(
          `- ${failure.file}: gzip=${failure.gzipBytes} budget=${failure.budgetBytes} (+${failure.overBytes})`,
        )
      }

      process.exitCode = 1
    }

    return
  }

  printUsage()
  process.exitCode = 1
}
