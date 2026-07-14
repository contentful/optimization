import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { isRecord } from './typeGuards'

const IMPLEMENTATIONS_DIRECTORY = 'implementations'
const PACKAGE_JSON_FILENAME = 'package.json'
const PNPM_COMMAND = 'pnpm'
const DISABLE_VERIFY_DEPS_BEFORE_RUN_CONFIG = '--config.verify-deps-before-run=false'
const LIST_NPM_PACKAGE_TARGETS_SCRIPT = 'scripts/list-npm-package-targets.ts'
const SUCCESS_EXIT_CODE = 0
const FAILURE_EXIT_CODE = 1
const PLAYWRIGHT_PACKAGE_NAMES = new Set(['playwright', '@playwright/test'])
const ACTIONS_REQUIRING_ENV_FILE = new Set([
  'implementation:setup:e2e',
  'implementation:test:e2e:run',
  'serve',
  'test:e2e',
])

interface ImplementationConfig {
  name: string
  scripts: ReadonlySet<string>
  usesPlaywright: boolean
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

function hasExplicitFrozenLockfileFlag(args: readonly string[]): boolean {
  return args.includes('--frozen-lockfile') || args.includes('--no-frozen-lockfile')
}

function runPnpm(implementation: string, args: readonly string[]): number {
  const implementationDir = `implementations/${implementation}`
  const hasLocalWorkspaceConfig = existsSync(path.join(implementationDir, 'pnpm-workspace.yaml'))
  const commandArgs = ['--dir', implementationDir, DISABLE_VERIFY_DEPS_BEFORE_RUN_CONFIG]

  if (!hasLocalWorkspaceConfig) {
    commandArgs.push('--ignore-workspace')
  }

  commandArgs.push(...args)

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

function getLocalPackageTarballPath(packageName: string): string {
  const packageFileName = packageName.replace(/^@/u, '').replace(/\//gu, '-')
  return path.join('pkgs', `${packageFileName}-local.tgz`)
}

function localPackageTarballsExist(): boolean {
  const result = spawnSync(
    PNPM_COMMAND,
    ['exec', 'tsx', LIST_NPM_PACKAGE_TARGETS_SCRIPT, 'npm-targets'],
    {
      encoding: 'utf8',
    },
  )

  if (result.error) {
    process.stderr.write(`${result.error.message}\n`)
    return false
  }

  if (result.status !== SUCCESS_EXIT_CODE) {
    process.stderr.write(result.stderr.trim() || 'Failed to list npm package targets.\n')
    return false
  }

  return result.stdout
    .trim()
    .split('\n')
    .filter((line) => line !== '')
    .every((line) => {
      const [packageName] = line.split('\t')
      return packageName !== undefined && existsSync(getLocalPackageTarballPath(packageName))
    })
}

function ensureLocalPackageTarballs(): number {
  if (localPackageTarballsExist()) {
    return SUCCESS_EXIT_CODE
  }

  process.stdout.write('\n> building local package tarballs before implementation install\n')

  const result = spawnSync(PNPM_COMMAND, ['run', 'build:pkgs'], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })

  if (result.error) {
    process.stderr.write(`${result.error.message}\n`)
    return FAILURE_EXIT_CODE
  }

  return result.status ?? FAILURE_EXIT_CODE
}

function ensureImplementationEnvFile(implementation: string): void {
  const implementationDir = path.join(IMPLEMENTATIONS_DIRECTORY, implementation)
  const envPath = path.join(implementationDir, '.env')
  const envExamplePath = path.join(implementationDir, '.env.example')

  if (existsSync(envPath) || !existsSync(envExamplePath)) {
    return
  }

  copyFileSync(envExamplePath, envPath)
  process.stdout.write(`\n> created ${envPath} from .env.example\n`)
}

function runScript(
  implementation: string,
  scriptName: string,
  scriptArgs: readonly string[] = [],
): number {
  const args = ['run', scriptName, ...scriptArgs]
  return runPnpm(implementation, args)
}

function runTypecheckAction(
  implementation: ImplementationConfig,
  actionArgs: readonly string[],
): number {
  if (!implementation.scripts.has('typecheck')) {
    process.stdout.write(
      `\n> skipping typecheck for "${implementation.name}" (no typecheck script)\n`,
    )
    return SUCCESS_EXIT_CODE
  }

  return runScript(implementation.name, 'typecheck', actionArgs)
}

function runImplementationInstallAction(
  implementation: string,
  actionArgs: readonly string[],
): number {
  const localPackageTarballsExitCode = ensureLocalPackageTarballs()
  if (localPackageTarballsExitCode !== SUCCESS_EXIT_CODE) {
    return localPackageTarballsExitCode
  }

  const installArgs = [
    'install',
    '--force',
    '--no-lockfile',
    '--no-optimistic-repeat-install',
    '--update-checksums',
    ...actionArgs,
  ]

  if (!hasExplicitFrozenLockfileFlag(actionArgs)) {
    installArgs.push('--no-frozen-lockfile')
  }

  return runPnpm(implementation, installArgs)
}

function runAction(
  implementation: ImplementationConfig,
  requestedAction: string,
  actionArgs: readonly string[],
): number {
  switch (requestedAction) {
    case 'implementation:install':
      return runImplementationInstallAction(implementation.name, actionArgs)
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
    case 'typecheck':
      return runTypecheckAction(implementation, actionArgs)
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

function runRequestedAction(
  implementation: ImplementationConfig,
  requestedAction: string,
  actionArgs: readonly string[],
): number {
  if (ACTIONS_REQUIRING_ENV_FILE.has(requestedAction)) {
    ensureImplementationEnvFile(implementation.name)
  }

  return runAction(implementation, requestedAction, actionArgs)
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

    const exitCode = runRequestedAction(implementation, action, actionArgs)
    if (exitCode !== SUCCESS_EXIT_CODE) {
      return exitCode
    }
  }

  return SUCCESS_EXIT_CODE
}

process.exitCode = main(process.argv.slice(2))
