import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const IMPLEMENTATIONS_DIRECTORY = 'implementations'
const PACKAGE_JSON_FILENAME = 'package.json'
const PNPM_COMMAND = 'pnpm'
const SUCCESS_EXIT_CODE = 0
const FAILURE_EXIT_CODE = 1
const PLAYWRIGHT_PACKAGE_NAMES = new Set(['playwright', '@playwright/test'])

interface ImplementationConfig {
  name: string
  scripts: ReadonlySet<string>
  usesPlaywright: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function toStringRecord(value: unknown): Record<string, string> {
  if (!isRecord(value)) {
    return {}
  }

  const record: Record<string, string> = {}
  for (const [key, entryValue] of Object.entries(value)) {
    if (typeof entryValue === 'string') {
      record[key] = entryValue
    }
  }

  return record
}

function tryReadFile(pathToFile: string): string | undefined {
  try {
    return readFileSync(pathToFile, 'utf8')
  } catch {
    return undefined
  }
}

function readImplementationConfigs(): ImplementationConfig[] {
  const implementationsPath = path.resolve(process.cwd(), IMPLEMENTATIONS_DIRECTORY)
  const entries = readdirSync(implementationsPath, { withFileTypes: true })
  const configs: ImplementationConfig[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue
    }

    const implementationPath = path.join(implementationsPath, entry.name)
    const packageJsonPath = path.join(implementationPath, PACKAGE_JSON_FILENAME)

    const packageJsonContents = tryReadFile(packageJsonPath)
    if (!packageJsonContents) {
      continue
    }

    const parsedPackageJson = JSON.parse(packageJsonContents) as unknown
    if (!isRecord(parsedPackageJson)) {
      throw new Error(`Invalid package.json format for implementation "${entry.name}"`)
    }

    const scripts = toStringRecord(parsedPackageJson.scripts)
    const dependencies = toStringRecord(parsedPackageJson.dependencies)
    const devDependencies = toStringRecord(parsedPackageJson.devDependencies)
    const dependencyNames = new Set([...Object.keys(dependencies), ...Object.keys(devDependencies)])

    const usesPlaywright = [...dependencyNames].some((dependencyName) =>
      PLAYWRIGHT_PACKAGE_NAMES.has(dependencyName),
    )

    configs.push({
      name: entry.name,
      scripts: new Set(Object.keys(scripts)),
      usesPlaywright,
    })
  }

  return configs.sort((left, right) => left.name.localeCompare(right.name))
}

function printUsage(implementations: readonly string[]): void {
  process.stderr.write(
    'Usage:\n' +
      '  pnpm run implementation:run -- --all <action> [args...]\n' +
      '  pnpm run implementation:run -- <implementation> <action> [args...]\n\n' +
      'Actions:\n' +
      '  implementation:install\n' +
      '  implementation:build:run\n' +
      '  implementation:test:unit:run\n' +
      '  implementation:playwright:install\n' +
      '  implementation:playwright:install-deps\n' +
      '  implementation:setup:e2e\n' +
      '  implementation:test:e2e:run\n' +
      '  <any implementation-local script name>\n\n' +
      `Implementations: ${implementations.join(', ')}\n`,
  )
}

function stripLeadingSeparator(argv: string[]): void {
  while (argv[0] === '--') {
    argv.shift()
  }
}

function runPnpm(implementation: string, args: readonly string[]): number {
  const commandArgs = ['--dir', `implementations/${implementation}`, '--ignore-workspace', ...args]

  process.stdout.write(`\n> ${PNPM_COMMAND} ${commandArgs.join(' ')}\n`)

  const result = spawnSync(PNPM_COMMAND, commandArgs, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })

  if (result.error) {
    process.stderr.write(`${result.error.message}\n`)
    return FAILURE_EXIT_CODE
  }

  return result.status ?? FAILURE_EXIT_CODE
}

function runScript(
  implementation: string,
  scriptName: string,
  scriptArgs: readonly string[] = [],
): number {
  const args = ['run', scriptName, ...scriptArgs]
  return runPnpm(implementation, args)
}

function runAction(
  implementation: ImplementationConfig,
  requestedAction: string,
  actionArgs: readonly string[],
): number {
  switch (requestedAction) {
    case 'implementation:install':
      return runPnpm(implementation.name, ['install', '--force', ...actionArgs])
    case 'implementation:build:run': {
      if (implementation.scripts.has('build')) {
        const buildExitCode = runScript(implementation.name, 'build')
        if (buildExitCode !== SUCCESS_EXIT_CODE) {
          return buildExitCode
        }
      }

      return runScript(implementation.name, 'typecheck')
    }
    case 'implementation:test:unit:run':
      return runScript(implementation.name, 'test:unit', actionArgs)
    case 'implementation:playwright:install':
      if (!implementation.usesPlaywright) {
        process.stdout.write(
          `\n> skipping Playwright install for "${implementation.name}" (no Playwright dependency)\n`,
        )
        return SUCCESS_EXIT_CODE
      }

      return runPnpm(implementation.name, ['exec', 'playwright', 'install', ...actionArgs])
    case 'implementation:playwright:install-deps':
      if (!implementation.usesPlaywright) {
        process.stdout.write(
          `\n> skipping Playwright system deps for "${implementation.name}" (no Playwright dependency)\n`,
        )
        return SUCCESS_EXIT_CODE
      }

      if (process.platform !== 'linux') {
        process.stdout.write('\n> skipping Playwright system deps install on non-Linux platform\n')
        return SUCCESS_EXIT_CODE
      }

      return runPnpm(implementation.name, ['exec', 'playwright', 'install-deps', ...actionArgs])
    case 'implementation:setup:e2e': {
      const playwrightInstallExitCode = runAction(
        implementation,
        'implementation:playwright:install',
        actionArgs,
      )
      if (playwrightInstallExitCode !== SUCCESS_EXIT_CODE) {
        return playwrightInstallExitCode
      }

      return runAction(implementation, 'implementation:playwright:install-deps', actionArgs)
    }
    case 'implementation:test:e2e:run':
      if (implementation.scripts.has('test:e2e:android:full')) {
        return runScript(implementation.name, 'test:e2e:android:full', actionArgs)
      }

      return runScript(implementation.name, 'test:e2e', actionArgs)
    default:
      return runScript(implementation.name, requestedAction, actionArgs)
  }
}

function main(rawArgv: readonly string[]): number {
  const implementations = readImplementationConfigs()
  const implementationNames = implementations.map((implementation) => implementation.name)
  const implementationByName = new Map(
    implementations.map((implementation) => [implementation.name, implementation] as const),
  )

  const argv = [...rawArgv]
  stripLeadingSeparator(argv)

  if (argv.length < 2) {
    printUsage(implementationNames)
    return FAILURE_EXIT_CODE
  }

  const targets: string[] = []
  if (argv[0] === '--all') {
    targets.push(...implementationNames)
    argv.shift()
    stripLeadingSeparator(argv)
  } else {
    const requestedImplementation = argv.shift()
    if (!requestedImplementation || !implementationByName.has(requestedImplementation)) {
      process.stderr.write(`Unknown implementation: ${requestedImplementation ?? '(missing)'}\n`)
      printUsage(implementationNames)
      return FAILURE_EXIT_CODE
    }

    targets.push(requestedImplementation)
    stripLeadingSeparator(argv)
  }

  const action = argv.shift()
  if (!action) {
    printUsage(implementationNames)
    return FAILURE_EXIT_CODE
  }

  stripLeadingSeparator(argv)
  const actionArgs = [...argv]

  for (const implementationName of targets) {
    const implementation = implementationByName.get(implementationName)
    if (!implementation) {
      process.stderr.write(`Unknown implementation: ${implementationName}\n`)
      return FAILURE_EXIT_CODE
    }

    const exitCode = runAction(implementation, action, actionArgs)
    if (exitCode !== SUCCESS_EXIT_CODE) {
      return exitCode
    }
  }

  return SUCCESS_EXIT_CODE
}

process.exitCode = main(process.argv.slice(2))
