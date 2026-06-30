/* eslint-disable no-console -- This CLI prints machine-readable records and errors. */

import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { isRecord } from './typeGuards'

interface PackageManifest {
  dependencies: Record<string, string>
  name: string
  optionalDependencies: Record<string, string>
  private: boolean
}

interface WorkspacePackage {
  manifest: PackageManifest
  name: string
  path: string
}

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const workspacePackages = readWorkspacePackages()
const packageByName = new Map(
  workspacePackages.map((workspacePackage) => [workspacePackage.name, workspacePackage]),
)

const [command, packageName] = process.argv.slice(2)

if (command === 'npm-targets') {
  for (const target of getNpmPublishTargets()) {
    console.log(
      [target.name, path.relative(rootDir, target.path), npmNoticeReportPath(target.name)].join(
        '\t',
      ),
    )
  }
} else if (command === 'npm-report-targets') {
  for (const target of getNpmPublishTargets()) {
    console.log(getReportTarget(target.name))
  }
} else if (command === 'report-target') {
  if (packageName === undefined) {
    fail('Usage: tsx scripts/list-npm-notice-targets.ts report-target <package-name>')
  }

  console.log(getReportTarget(packageName))
} else {
  fail(
    'Usage: tsx scripts/list-npm-notice-targets.ts npm-targets|npm-report-targets|report-target <package-name>',
  )
}

function getNpmPublishTargets(): WorkspacePackage[] {
  return workspacePackages.filter(
    (workspacePackage) =>
      workspacePackage.name.startsWith('@contentful/optimization-') &&
      workspacePackage.name !== '@contentful/optimization-js-bridge' &&
      !workspacePackage.manifest.private,
  )
}

function readWorkspacePackages(): WorkspacePackage[] {
  const listResult = spawnSync(
    'pnpm',
    ['--silent', 'list', '--recursive', '--depth', '-1', '--json'],
    {
      cwd: rootDir,
      encoding: 'utf8',
    },
  )

  if (listResult.error) {
    fail(listResult.error.message)
  }

  if (listResult.status !== 0) {
    fail(listResult.stderr.trim() || 'Failed to list pnpm workspace packages.')
  }

  const parsedWorkspaceList: unknown = JSON.parse(listResult.stdout)

  if (!Array.isArray(parsedWorkspaceList)) {
    fail('Expected pnpm workspace package list to be an array.')
  }

  const packages = parsedWorkspaceList.map(readWorkspacePackage)
  const duplicatePackageNames = findDuplicates(
    packages.map((workspacePackage) => workspacePackage.name),
  )

  if (duplicatePackageNames.length > 0) {
    fail(`Duplicate workspace package names found: ${duplicatePackageNames.join(', ')}`)
  }

  return packages.sort((left, right) =>
    path.relative(rootDir, left.path).localeCompare(path.relative(rootDir, right.path)),
  )
}

function readWorkspacePackage(value: unknown): WorkspacePackage {
  if (!isRecord(value) || typeof value.name !== 'string' || typeof value.path !== 'string') {
    fail('pnpm returned a workspace package entry without a string name and path.')
  }

  const manifest = readPackageManifest(path.join(value.path, 'package.json'))

  if (manifest.name !== value.name) {
    fail(`Workspace package name mismatch for ${value.path}: ${value.name} != ${manifest.name}`)
  }

  return {
    manifest,
    name: value.name,
    path: value.path,
  }
}

function readPackageManifest(manifestPath: string): PackageManifest {
  const manifest: unknown = JSON.parse(readFileSync(manifestPath, 'utf8'))

  if (!isRecord(manifest) || typeof manifest.name !== 'string') {
    fail(`Invalid package manifest: ${manifestPath}`)
  }

  return {
    dependencies: readDependencyMap(manifest, 'dependencies', manifestPath),
    name: manifest.name,
    optionalDependencies: readDependencyMap(manifest, 'optionalDependencies', manifestPath),
    private: manifest.private === true,
  }
}

function readDependencyMap(
  manifest: Record<string, unknown>,
  fieldName: 'dependencies' | 'optionalDependencies',
  manifestPath: string,
): Record<string, string> {
  const { [fieldName]: value } = manifest

  if (value === undefined) {
    return {}
  }

  if (!isRecord(value)) {
    fail(`Expected ${fieldName} to be an object in ${manifestPath}`)
  }

  const dependencies: Record<string, string> = {}

  for (const [dependencyName, dependencyRange] of Object.entries(value)) {
    if (typeof dependencyRange !== 'string') {
      fail(`Expected ${fieldName}.${dependencyName} to be a string in ${manifestPath}`)
    }

    dependencies[dependencyName] = dependencyRange
  }

  return dependencies
}

function npmNoticeReportPath(packageName: string): string {
  return path.posix.join(
    'build/reports/third-party-notices/npm',
    `${packageName.replace(/^@contentful\//u, '')}.txt`,
  )
}

function getReportTarget(packageName: string): string {
  return [
    packageName,
    npmNoticeReportPath(packageName),
    ...getProductionWorkspaceClosure(packageName),
  ].join('\t')
}

function getProductionWorkspaceClosure(packageName: string): string[] {
  const packageNames: string[] = []
  const seen = new Set<string>()

  visit(packageName)

  return packageNames

  function visit(currentPackageName: string): void {
    if (seen.has(currentPackageName)) {
      return
    }

    const workspacePackage = packageByName.get(currentPackageName)

    if (workspacePackage === undefined) {
      fail(`Unknown workspace package: ${currentPackageName}`)
    }

    seen.add(currentPackageName)
    packageNames.push(currentPackageName)

    for (const [dependencyName, dependencyRange] of getProductionDependencies(workspacePackage)) {
      if (dependencyRange.startsWith('workspace:')) {
        visit(dependencyName)
      }
    }
  }
}

function getProductionDependencies(workspacePackage: WorkspacePackage): Array<[string, string]> {
  return [
    ...Object.entries(workspacePackage.manifest.dependencies),
    ...Object.entries(workspacePackage.manifest.optionalDependencies),
  ]
}

function findDuplicates(values: string[]): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value)
    }

    seen.add(value)
  }

  return [...duplicates].sort((left, right) => left.localeCompare(right))
}

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}
