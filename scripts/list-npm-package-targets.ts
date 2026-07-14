/* eslint-disable no-console -- This CLI prints machine-readable records and errors. */

import assert from 'node:assert/strict'
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
  version: string
}

interface WorkspacePackage {
  manifest: PackageManifest
  name: string
  path: string
}

interface ReleasedNpmPublishTarget extends WorkspacePackage {
  releaseTag: string
  version: string
}

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const workspacePackages = readWorkspacePackages()
const packageByName = new Map(
  workspacePackages.map((workspacePackage) => [workspacePackage.name, workspacePackage]),
)

const [command, ...args] = process.argv.slice(2)
const [packageName] = args

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
    fail('Usage: tsx scripts/list-npm-package-targets.ts report-target <package-name>')
  }

  console.log(getReportTarget(packageName))
} else if (command === 'npm-package-names') {
  for (const target of getRequiredNpmPublishTargets()) {
    console.log(target.name)
  }
} else if (command === 'npm-pnpm-filters') {
  console.log(
    getRequiredNpmPublishTargets()
      .map((target) => `--filter=${target.name}`)
      .join(' '),
  )
} else if (command === 'released-npm-targets') {
  for (const target of getReleasedNpmPublishTargets(args)) {
    console.log(
      [
        target.name,
        path.relative(rootDir, target.path),
        npmNoticeReportPath(target.name),
        target.releaseTag,
        target.version,
      ].join('\t'),
    )
  }
} else if (command === 'released-npm-pnpm-filters') {
  console.log(
    getReleasedNpmPublishTargets(args)
      .map((target) => `--filter=${target.name}`)
      .join(' '),
  )
} else if (command === 'self-check') {
  runSelfCheck()
  console.log('list-npm-package-targets self-check passed.')
} else {
  fail(
    'Usage: tsx scripts/list-npm-package-targets.ts npm-targets|npm-report-targets|report-target|npm-package-names|npm-pnpm-filters|released-npm-targets|released-npm-pnpm-filters|self-check <package-name|release-tag>',
  )
}

function getNpmPublishTargets(): WorkspacePackage[] {
  return workspacePackages.filter(
    (workspacePackage) =>
      workspacePackage.name.startsWith('@contentful/optimization-') &&
      !workspacePackage.manifest.private,
  )
}

function getRequiredNpmPublishTargets(): WorkspacePackage[] {
  const targets = getNpmPublishTargets()

  if (targets.length === 0) {
    fail('No npm package targets found.')
  }

  return targets
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
    version: readPackageVersion(manifest, manifestPath),
  }
}

function readPackageVersion(manifest: Record<string, unknown>, manifestPath: string): string {
  const { version } = manifest

  if (version === undefined) {
    return '0.0.0'
  }

  if (typeof version !== 'string') {
    fail(`Expected version to be a string in ${manifestPath}`)
  }

  return version
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

function getReleasedNpmPublishTargets(releaseTags: string[]): ReleasedNpmPublishTarget[] {
  const targetsByName = new Map(getNpmPublishTargets().map((target) => [target.name, target]))
  const releasedTargets = new Map<string, ReleasedNpmPublishTarget>()

  for (const releaseTag of releaseTags) {
    const release = parseNpmReleaseTag(releaseTag)

    if (release === undefined) {
      continue
    }

    for (const target of targetsByName.values()) {
      if (npmReleaseComponent(target.name) !== release.component) {
        continue
      }

      releasedTargets.set(target.name, {
        ...target,
        releaseTag,
        version: release.version,
      })
    }
  }

  return sortNpmPublishTargets([...releasedTargets.values()])
}

function parseNpmReleaseTag(
  releaseTag: string,
): { component: string; version: string } | undefined {
  const match = /^(optimization-[a-z0-9-]+)-v(.+)$/u.exec(releaseTag)

  if (match === null) {
    return undefined
  }

  const [, component, version] = match

  if (component === undefined || version === undefined) {
    return undefined
  }

  return { component, version }
}

function npmReleaseComponent(packageName: string): string {
  return packageName.replace(/^@contentful\//u, '')
}

function sortNpmPublishTargets(targets: ReleasedNpmPublishTarget[]): ReleasedNpmPublishTarget[] {
  const targetsByName = new Map(targets.map((target) => [target.name, target]))
  const sortedTargets: ReleasedNpmPublishTarget[] = []
  const visited = new Set<string>()

  for (const target of targets) {
    visit(target)
  }

  return sortedTargets

  function visit(target: ReleasedNpmPublishTarget): void {
    if (visited.has(target.name)) {
      return
    }

    visited.add(target.name)

    for (const [dependencyName, dependencyRange] of getProductionDependencies(target)) {
      const dependencyTarget = targetsByName.get(dependencyName)

      if (dependencyTarget !== undefined && dependencyRange.startsWith('workspace:')) {
        visit(dependencyTarget)
      }
    }

    sortedTargets.push(target)
  }
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

function runSelfCheck(): void {
  const [coreTarget] = getReleasedNpmPublishTargets(['optimization-core-v1.2.3'])
  assert.equal(coreTarget?.name, '@contentful/optimization-core')
  assert.equal(coreTarget.version, '1.2.3')

  const sortedNames = getReleasedNpmPublishTargets([
    'optimization-nextjs-v1.2.3',
    'optimization-react-web-v1.2.3',
    'optimization-web-v1.2.3',
    'optimization-node-v1.2.3',
    'optimization-core-v1.2.3',
    'optimization-api-client-v1.2.3',
    'optimization-api-schemas-v1.2.3',
  ]).map((target) => target.name)

  assert(
    sortedNames.indexOf('@contentful/optimization-api-schemas') <
      sortedNames.indexOf('@contentful/optimization-api-client'),
  )
  assert(
    sortedNames.indexOf('@contentful/optimization-api-client') <
      sortedNames.indexOf('@contentful/optimization-core'),
  )
  assert(
    sortedNames.indexOf('@contentful/optimization-core') <
      sortedNames.indexOf('@contentful/optimization-web'),
  )
  assert(
    sortedNames.indexOf('@contentful/optimization-web') <
      sortedNames.indexOf('@contentful/optimization-react-web'),
  )
  assert(
    sortedNames.indexOf('@contentful/optimization-react-web') <
      sortedNames.indexOf('@contentful/optimization-nextjs'),
  )
}

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}
