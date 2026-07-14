import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import {
  GitHub,
  Manifest,
  registerPlugin,
  type PluginFactoryOptions,
  type Strategy,
} from 'release-please'
import { parseConventionalCommits, type Commit } from 'release-please/build/src/commit'
import type { CandidateReleasePullRequest } from 'release-please/build/src/manifest'
import { ManifestPlugin } from 'release-please/build/src/plugin'
import type { Release } from 'release-please/build/src/release'
import type { Update, Updater } from 'release-please/build/src/update'
import type { Logger } from 'release-please/build/src/util/logger'
import { isRecord } from './typeGuards'

const DEFAULT_CONFIG_FILE = 'release-please-config.json'
const DEFAULT_MANIFEST_FILE = '.release-please-manifest.json'
const DEFAULT_TARGET_BRANCH = 'main'
const ANDROID_RELEASE_PATH = 'packages/android/ContentfulOptimization'
const SWIFT_RELEASE_PATH = 'packages/ios/ContentfulOptimization'

const SHARED_RUNTIME_PATHS = [
  'packages/universal/api-schemas',
  'packages/universal/api-client',
  'packages/universal/core-sdk',
  'packages/universal/optimization-js-bridge',
] as const

const NATIVE_TARGETS = [
  { path: ANDROID_RELEASE_PATH, scope: 'android' },
  { path: SWIFT_RELEASE_PATH, scope: 'swift' },
] as const

const RELEASE_COMMANDS = ['release-pr', 'github-release', 'self-check'] as const
const RELEASABLE_TYPES = new Set(['feat', 'fix', 'perf'])
const CHANGELOG_FILENAME = 'CHANGELOG.md'
const CHANGELOG_SEED_PLACEHOLDER = 'Release notes are managed by Release Please.'
const VERSIONED_LOCAL_PACKAGE_TARBALL_REFERENCE =
  /file:\.\.\/\.\.\/pkgs\/contentful-optimization-[a-z0-9-]+-\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?\.tgz/u
const STABLE_LOCAL_PACKAGE_TARBALL_REFERENCE =
  /file:\.\.\/\.\.\/pkgs\/contentful-optimization-[a-z0-9-]+-local\.tgz/u

type ReleaseCommand = (typeof RELEASE_COMMANDS)[number]
type NativeTarget = (typeof NATIVE_TARGETS)[number]
type ParsedOptions = ReturnType<typeof parseReleasePleaseArgs>['values']

registerPlugin(
  'native-bridge-impact',
  (options: PluginFactoryOptions) => new NativeBridgeImpactPlugin(options),
)

registerPlugin(
  'release-pr-changelog-format',
  (options: PluginFactoryOptions) => new ReleasePrChangelogFormatPlugin(options),
)

class NativeBridgeImpactPlugin extends ManifestPlugin {
  private readonly bootstrapSha: string | undefined

  constructor(options: PluginFactoryOptions) {
    super(options.github, options.targetBranch, options.repositoryConfig, options.logger)
    this.bootstrapSha = readNativeImpactBootstrapSha(options)
  }

  override async preconfigure(
    strategiesByPath: Record<string, Strategy>,
    commitsByPath: Record<string, Commit[]>,
    _releasesByPath: Record<string, Release>,
  ): Promise<Record<string, Strategy>> {
    const configuredNativeTargets = NATIVE_TARGETS.filter(
      (target) => this.repositoryConfig[target.path] !== undefined,
    )

    for (const target of configuredNativeTargets) {
      if (strategiesByPath[target.path] === undefined) {
        continue
      }

      const sharedCommits = await this.getSharedRuntimeCommitsSinceLatestNativeRelease(
        target,
        _releasesByPath,
      )

      if (sharedCommits.length === 0) {
        continue
      }

      commitsByPath[target.path] = [
        createSyntheticNativeImpactCommit(target, sharedCommits),
        ...(commitsByPath[target.path] ?? []),
      ]
    }

    return strategiesByPath
  }

  private async getSharedRuntimeCommitsSinceLatestNativeRelease(
    target: NativeTarget,
    releasesByPath: Record<string, Release>,
  ): Promise<Commit[]> {
    const releaseSha = releasesByPath[target.path]?.sha
    const baseSha = releaseSha === '' ? this.bootstrapSha : (releaseSha ?? this.bootstrapSha)

    if (baseSha === undefined || baseSha === '') {
      return []
    }

    const commits = await this.github.commitsSince(
      this.targetBranch,
      (commit) => commit.sha === baseSha,
      { backfillFiles: true },
    )

    return getReleasableSharedCommits(commits)
  }
}

class ReleasePrChangelogFormatPlugin extends ManifestPlugin {
  constructor(options: PluginFactoryOptions) {
    super(options.github, options.targetBranch, options.repositoryConfig, options.logger)
  }

  override async run(
    pullRequests: CandidateReleasePullRequest[],
  ): Promise<CandidateReleasePullRequest[]> {
    this.logger.debug('Formatting generated changelog updates')
    await Promise.resolve()

    for (const candidate of pullRequests) {
      candidate.pullRequest.updates = candidate.pullRequest.updates.map(formatChangelogUpdate)
    }

    return pullRequests
  }
}

class ChangelogFormatUpdater implements Updater {
  private readonly updater: Updater

  constructor(updater: Updater) {
    this.updater = updater
  }

  updateContent(content: string | undefined, logger?: Logger): string {
    return normalizeReleasePleaseChangelogMarkdown(this.updater.updateContent(content, logger))
  }
}

function readNativeImpactBootstrapSha(options: PluginFactoryOptions): string | undefined {
  const { type } = options

  if (!isRecord(type)) {
    return undefined
  }

  const { bootstrapSha } = type

  if (typeof bootstrapSha === 'string') {
    return bootstrapSha
  }

  return undefined
}

async function main(): Promise<void> {
  const { values, positionals } = parseReleasePleaseArgs()
  const command = readCommand(positionals[0])

  if (command === 'self-check') {
    runSelfCheck()
    process.stdout.write('release-please self-check passed.\n')
    return
  }

  await runReleasePleaseCommand(command, values)
}

function parseReleasePleaseArgs(): ReturnType<typeof parseArgs> {
  return parseArgs({
    allowPositionals: true,
    options: {
      'config-file': { type: 'string' },
      'dry-run': { type: 'boolean' },
      'manifest-file': { type: 'string' },
      'repo-url': { type: 'string' },
      token: { type: 'string' },
      'target-branch': { type: 'string' },
    },
  })
}

async function runReleasePleaseCommand(
  command: ReleaseCommand,
  values: ParsedOptions,
): Promise<void> {
  const { owner, repo, token } = readGitHubOptions(values)

  const github = await GitHub.create({ owner, repo, token })
  const targetBranch = readStringOption(values, 'target-branch') ?? DEFAULT_TARGET_BRANCH
  const manifest = await Manifest.fromManifest(
    github,
    targetBranch,
    readStringOption(values, 'config-file') ?? DEFAULT_CONFIG_FILE,
    readStringOption(values, 'manifest-file') ?? DEFAULT_MANIFEST_FILE,
  )

  await runManifestCommand(command, manifest, values['dry-run'] === true)
}

function readGitHubOptions(values: ParsedOptions): { owner: string; repo: string; token: string } {
  const token =
    readStringOption(values, 'token') ??
    process.env.RELEASE_PLEASE_TOKEN ??
    process.env.GITHUB_TOKEN
  const repoUrl = readStringOption(values, 'repo-url') ?? process.env.GITHUB_REPOSITORY

  if (token === undefined || token === '') {
    fail('Set RELEASE_PLEASE_TOKEN or pass --token.')
  }

  if (repoUrl === undefined || repoUrl === '') {
    fail('Pass --repo-url or set GITHUB_REPOSITORY.')
  }

  return { ...parseRepoUrl(repoUrl), token }
}

function parseRepoUrl(repoUrl: string): { owner: string; repo: string } {
  const match = /^([^/]+)\/([^/]+)$/u.exec(repoUrl)

  if (match === null) {
    fail(`Expected repo URL in owner/repo form, got ${repoUrl}.`)
  }

  const [, owner, repo] = match

  if (owner === undefined || repo === undefined) {
    fail(`Expected repo URL in owner/repo form, got ${repoUrl}.`)
  }

  return { owner, repo }
}

function readStringOption(values: ParsedOptions, name: string): string | undefined {
  const { [name]: value } = values

  if (typeof value === 'string') {
    return value
  }

  return undefined
}

async function runManifestCommand(
  command: ReleaseCommand,
  manifest: Manifest,
  isDryRun: boolean,
): Promise<void> {
  if (command === 'release-pr' && isDryRun) {
    const pullRequests = await manifest.buildPullRequests()
    process.stdout.write(`Would create or update ${pullRequests.length} release PR(s).\n`)
    return
  }

  if (command === 'release-pr') {
    await manifest.createPullRequests()
    return
  }

  if (isDryRun) {
    const releases = await manifest.buildReleases()
    process.stdout.write(`Would create ${releases.length} GitHub release(s).\n`)
    return
  }

  await manifest.createReleases()
}

function formatChangelogUpdate(update: Update): Update {
  if (!update.path.endsWith(`/${CHANGELOG_FILENAME}`) && update.path !== CHANGELOG_FILENAME) {
    return update
  }

  return {
    ...update,
    updater: new ChangelogFormatUpdater(update.updater),
  }
}

function normalizeReleasePleaseChangelogMarkdown(content: string): string {
  return `${content
    .replace(/\n{3,}/gu, '\n\n')
    .replace(/^(\s*)\* /gmu, '$1- ')
    .trimEnd()}\n`
}

function readCommand(command: string | undefined): ReleaseCommand {
  const selectedCommand = command ?? 'release-pr'

  if (isReleaseCommand(selectedCommand)) {
    return selectedCommand
  }

  fail(`Usage: pnpm release:please -- ${RELEASE_COMMANDS.join('|')} [options]`)
}

function isReleaseCommand(command: string): command is ReleaseCommand {
  switch (command) {
    case 'release-pr':
    case 'github-release':
    case 'self-check':
      return true
    default:
      return false
  }
}

function getReleasableSharedCommits(commits: Commit[]): Commit[] {
  const commitsBySha = new Map<string, Commit>()

  for (const commit of commits) {
    if (
      commitsBySha.has(commit.sha) ||
      !touchesSharedRuntime(commit) ||
      !isReleasableCommit(commit)
    ) {
      continue
    }

    commitsBySha.set(commit.sha, commit)
  }

  return [...commitsBySha.values()]
}

function touchesSharedRuntime(commit: Commit): boolean {
  return (
    commit.files?.some((file) =>
      SHARED_RUNTIME_PATHS.some(
        (sharedPath) => file === sharedPath || file.startsWith(`${sharedPath}/`),
      ),
    ) ?? false
  )
}

function isReleasableCommit(commit: Commit): boolean {
  return parseConventionalCommits([commit]).some(
    (conventionalCommit) =>
      conventionalCommit.breaking || RELEASABLE_TYPES.has(conventionalCommit.type),
  )
}

function createSyntheticNativeImpactCommit(target: NativeTarget, sharedCommits: Commit[]): Commit {
  const [sourceCommit] = sharedCommits

  assert(sourceCommit !== undefined)

  return {
    author: sourceCommit.author,
    files: [target.path],
    message: `fix(${target.scope}): refresh shared native runtime`,
    pullRequest: sourceCommit.pullRequest,
    sha: sourceCommit.sha,
  }
}

function runSelfCheck(): void {
  assert.equal(
    normalizeReleasePleaseChangelogMarkdown(`# Changelog

## [1.0.0](https://example.com) (2026-07-14)


### Features

* root item
  * nested item
`),
    `# Changelog

## [1.0.0](https://example.com) (2026-07-14)

### Features

- root item
  - nested item
`,
  )

  assertNoChangelogSeedPlaceholders()
  assert.equal(
    getStableLocalPackageTarballReference('@contentful/optimization-web'),
    'file:../../pkgs/contentful-optimization-web-local.tgz',
  )
  assertImplementationLocalPackageTarballReferences()

  const releasableSharedCommit = {
    files: ['packages/universal/optimization-js-bridge/src/index.ts'],
    message: 'fix(bridge): refresh bridge payload',
    sha: 'abc123',
  }
  const docsOnlyCommit = {
    files: ['packages/universal/core-sdk/README.md'],
    message: 'docs(core): clarify setup',
    sha: 'def456',
  }
  const sharedCommits = getReleasableSharedCommits([docsOnlyCommit, releasableSharedCommit])
  assert.equal(sharedCommits.length, 1)

  const [androidTarget] = NATIVE_TARGETS
  const syntheticCommit = createSyntheticNativeImpactCommit(androidTarget, sharedCommits)
  assert.equal(syntheticCommit.message, 'fix(android): refresh shared native runtime')
  assert.equal(syntheticCommit.sha, releasableSharedCommit.sha)
}

function assertNoChangelogSeedPlaceholders(): void {
  for (const changelogPath of findPackageChangelogPaths()) {
    const changelog = readFileSync(changelogPath, 'utf8')
    assert.equal(
      changelog.includes(CHANGELOG_SEED_PLACEHOLDER),
      false,
      `${changelogPath} still contains the release-please seed placeholder.`,
    )
  }
}

function findPackageChangelogPaths(): string[] {
  const changelogPaths: string[] = []

  visit('packages')

  return changelogPaths.sort((left, right) => left.localeCompare(right))

  function visit(directory: string): void {
    if (!existsSync(directory)) {
      return
    }

    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const entryPath = `${directory}/${entry.name}`

      if (entry.isDirectory()) {
        visit(entryPath)
      } else if (entry.isFile() && entry.name === CHANGELOG_FILENAME) {
        changelogPaths.push(entryPath)
      }
    }
  }
}

function getStableLocalPackageTarballReference(packageName: string): string {
  const packageFileName = packageName.replace(/^@/u, '').replace(/\//gu, '-')
  return `file:../../pkgs/${packageFileName}-local.tgz`
}

function assertImplementationLocalPackageTarballReferences(): void {
  let stableReferenceCount = 0

  for (const referencePath of findImplementationLocalPackageReferencePaths()) {
    const content = readFileSync(referencePath, 'utf8')
    const versionedReference = VERSIONED_LOCAL_PACKAGE_TARBALL_REFERENCE.exec(content)

    assert.equal(
      versionedReference,
      null,
      `${referencePath} contains a versioned local package tarball reference.`,
    )

    if (content.includes('file:../../pkgs/contentful-optimization-')) {
      assert.match(content, STABLE_LOCAL_PACKAGE_TARBALL_REFERENCE)
      stableReferenceCount += 1
    }
  }

  assert(stableReferenceCount > 0)
}

function findImplementationLocalPackageReferencePaths(): string[] {
  const referencePaths: string[] = []

  for (const entry of readdirSync('implementations', { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue
    }

    const workspaceConfigPath = `implementations/${entry.name}/pnpm-workspace.yaml`
    if (existsSync(workspaceConfigPath)) {
      referencePaths.push(workspaceConfigPath)
    }
  }

  referencePaths.push('implementations/react-native-sdk/package.json')

  return referencePaths.sort((left, right) => left.localeCompare(right))
}

function fail(message: string): never {
  process.stderr.write(`${message}\n`)
  process.exit(1)
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error)
  fail(message)
})
