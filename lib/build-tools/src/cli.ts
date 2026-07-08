import { checkBundleSize } from './bundleSize'
import { checkClientBoundaryExports } from './clientBoundaryExports'
import { emitDualDts } from './emitDualDts'
import { preparePublishReadme } from './publishReadme'

function printUsage(): void {
  process.stderr.write(
    'Usage:\n' +
      '  build-tools emit-dual-dts [distDir]\n' +
      '  build-tools bundle-size [packageDir] [--report-only]\n' +
      '  build-tools check-client-boundary-exports [path...]\n' +
      '  build-tools rewrite-readme prepare [packageDir]\n' +
      '\n' +
      'Examples:\n' +
      '  build-tools emit-dual-dts ./dist\n' +
      '  build-tools bundle-size\n' +
      '  build-tools check-client-boundary-exports ./src ./dist\n' +
      '  build-tools rewrite-readme prepare\n' +
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

function failUsage(): void {
  printUsage()
  process.exitCode = 1
}

function runBundleSizeCommand(args: string[]): void {
  const parsed = parseBundleSizeArgs(args)

  if (parsed === undefined) {
    failUsage()
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
}

function runCheckClientBoundaryExportsCommand(args: string[]): void {
  const failures = checkClientBoundaryExports({ paths: args })

  if (failures.length === 0) return

  process.stderr.write('Unsupported export * in client boundaries:\n')

  for (const failure of failures) {
    process.stderr.write(`- ${failure.file}\n`)
  }

  process.exitCode = 1
}

function runRewriteReadmeCommand(args: string[]): void {
  const [action, packageDir = '.'] = args

  if (action === 'prepare') {
    preparePublishReadme(packageDir)
    return
  }

  failUsage()
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
    runBundleSizeCommand(rest)
    return
  }

  if (command === 'check-client-boundary-exports') {
    runCheckClientBoundaryExportsCommand(rest)
    return
  }

  if (command === 'rewrite-readme') {
    runRewriteReadmeCommand(rest)
    return
  }

  failUsage()
}
