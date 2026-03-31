import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const README_FILE_NAME = 'README.md'
const README_BACKUP_DIR_NAME = '.tmp'
const README_BACKUP_FILE_NAME = 'build-tools-publish-readme-backup.md'
const README_BASE_URL = 'https://publish-readme.invalid'
const ABSOLUTE_TARGET_PATTERN = /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i
const RELATIVE_IMAGE_EXTENSIONS = new Set([
  '.avif',
  '.gif',
  '.jpeg',
  '.jpg',
  '.png',
  '.svg',
  '.webp',
])

interface PublishReadmeOverrides {
  publishRef?: string
}

interface PublishReadmeConfig {
  blobBaseUrl: string
  rawBaseUrl: string
  readmeUrl: URL
}

interface RepositoryConfig {
  directory: string
  url: string
}

interface PackageJsonLike {
  repository?: unknown
}

function getReadmePath(packageDir: string): string {
  return path.resolve(packageDir, README_FILE_NAME)
}

function getReadmeBackupPath(packageDir: string): string {
  return path.resolve(packageDir, README_BACKUP_DIR_NAME, README_BACKUP_FILE_NAME)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isNodeErrorWithCode(error: unknown, code: string): error is NodeJS.ErrnoException {
  return isRecord(error) && error.code === code
}

function getPackageJson(packageDir: string): PackageJsonLike {
  const packageJson: unknown = JSON.parse(
    readFileSync(path.resolve(packageDir, 'package.json'), 'utf8'),
  )

  if (!isRecord(packageJson)) {
    throw new Error(`Invalid package.json in ${path.resolve(packageDir, 'package.json')}.`)
  }

  return packageJson
}

function getRepositoryConfig(packageJson: PackageJsonLike, packageDir: string): RepositoryConfig {
  const { repository } = packageJson

  if (!isRecord(repository)) {
    throw new Error(
      `Missing repository.url or repository.directory in ${path.resolve(packageDir, 'package.json')}.`,
    )
  }

  const { directory: rawDirectory, url } = repository

  if (typeof rawDirectory !== 'string' || typeof url !== 'string') {
    throw new Error(
      `Missing repository.url or repository.directory in ${path.resolve(packageDir, 'package.json')}.`,
    )
  }

  const directory = rawDirectory.replaceAll(path.sep, path.posix.sep).replace(/^\/+|\/+$/g, '')

  if (directory === '') {
    throw new Error(
      `repository.directory must not be empty in ${path.resolve(packageDir, 'package.json')}.`,
    )
  }

  return {
    directory,
    url,
  }
}

function getGitHubSlug(repositoryUrl: string, packageDir: string): string {
  const normalizedUrl = repositoryUrl
    .replace(/^git\+/, '')
    .replace(/\.git$/, '')
    .replace(/\/$/, '')
  const match = /^(?:https:\/\/github\.com\/|git@github\.com:)(.+)$/.exec(normalizedUrl)

  if (match?.[1] === undefined) {
    throw new Error(
      `Unsupported repository.url in ${path.resolve(packageDir, 'package.json')}: ${repositoryUrl}.`,
    )
  }

  return match[1]
}

function getPublishRef(overrides: PublishReadmeOverrides): string {
  const publishRef = overrides.publishRef ?? process.env.RELEASE_TAG

  if (!publishRef) {
    throw new Error('Missing publish ref. Set RELEASE_TAG before rewriting package READMEs.')
  }

  return publishRef
}

function getPublishReadmeConfig(
  packageDir: string,
  overrides: PublishReadmeOverrides = {},
): PublishReadmeConfig {
  const packageJson = getPackageJson(packageDir)
  const repository = getRepositoryConfig(packageJson, packageDir)
  const slug = getGitHubSlug(repository.url, packageDir)
  const publishRef = getPublishRef(overrides)

  return {
    blobBaseUrl: `https://github.com/${slug}/blob/${publishRef}`,
    rawBaseUrl: `https://raw.githubusercontent.com/${slug}/${publishRef}`,
    readmeUrl: new URL(`/${repository.directory}/${README_FILE_NAME}`, README_BASE_URL),
  }
}

function isRelativeTarget(target: string): boolean {
  return !ABSOLUTE_TARGET_PATTERN.test(target)
}

function isImagePath(repoPath: string): boolean {
  return RELATIVE_IMAGE_EXTENSIONS.has(path.posix.extname(repoPath).toLowerCase())
}

function rewriteTarget(target: string, config: PublishReadmeConfig, isImage: boolean): string {
  if (!isRelativeTarget(target)) {
    return target
  }

  const resolvedTarget = new URL(target.replace(/^<|>$/g, ''), config.readmeUrl)
  const repoPath = resolvedTarget.pathname.slice(1)
  const baseUrl = isImage || isImagePath(repoPath) ? config.rawBaseUrl : config.blobBaseUrl

  return `${baseUrl}/${repoPath}${resolvedTarget.search}${resolvedTarget.hash}`
}

function rewriteHtmlTargets(line: string, config: PublishReadmeConfig): string {
  return line.replaceAll(
    /\b(href|src)=(["'])([^"']+)\2/g,
    (_match, attribute, quote, rawTarget) =>
      `${attribute}=${quote}${rewriteTarget(String(rawTarget), config, attribute === 'src')}${quote}`,
  )
}

function readFileIfExists(filePath: string): string | undefined {
  try {
    return readFileSync(filePath, 'utf8')
  } catch (error) {
    if (isNodeErrorWithCode(error, 'ENOENT')) {
      return undefined
    }

    throw error
  }
}

function rewriteMarkdownLinkMatches(
  line: string,
  config: PublishReadmeConfig,
  pattern: RegExp,
): string {
  return line.replaceAll(pattern, (_match, label: string, rawTarget: string, ...rest) => {
    const title = typeof rest[0] === 'string' ? rest[0] : ''

    return `${label}(${rewriteTarget(rawTarget, config, label.startsWith('!'))}${title})`
  })
}

function rewriteMarkdownLinks(line: string, config: PublishReadmeConfig): string {
  return [
    /(!?\[[^\]\r\n]+])\((<[^>\r\n]+>)(\s+"[^"\r\n]*")\)/g,
    /(!?\[[^\]\r\n]+])\((<[^>\r\n]+>)(\s+'[^'\r\n]*')\)/g,
    /(!?\[[^\]\r\n]+])\((<[^>\r\n]+>)\)/g,
    /(!?\[[^\]\r\n]+])\(([^()\s]+)(\s+"[^"\r\n]*")\)/g,
    /(!?\[[^\]\r\n]+])\(([^()\s]+)(\s+'[^'\r\n]*')\)/g,
    /(!?\[[^\]\r\n]+])\(([^()\s]+)\)/g,
  ].reduce(
    (rewrittenLine, pattern) => rewriteMarkdownLinkMatches(rewrittenLine, config, pattern),
    line,
  )
}

export function rewriteReadmeForPublish(
  readmeContent: string,
  config: PublishReadmeConfig,
): string {
  const lines = readmeContent.split('\n')
  let activeFence: '```' | '~~~' | undefined = undefined

  return lines
    .map((line) => {
      const trimmedLine = line.trimStart()
      const fenceMarker = trimmedLine.startsWith('```')
        ? '```'
        : trimmedLine.startsWith('~~~')
          ? '~~~'
          : undefined

      if (fenceMarker !== undefined) {
        activeFence = activeFence === fenceMarker ? undefined : fenceMarker
        return line
      }

      if (activeFence !== undefined) {
        return line
      }

      return rewriteHtmlTargets(rewriteMarkdownLinks(line, config), config)
    })
    .join('\n')
}

export function preparePublishReadme(
  packageDir = '.',
  overrides: PublishReadmeOverrides = {},
): void {
  const resolvedPackageDir = path.resolve(packageDir)
  const readmePath = getReadmePath(resolvedPackageDir)
  const backupPath = getReadmeBackupPath(resolvedPackageDir)
  const backupReadme = readFileIfExists(backupPath)

  if (backupReadme !== undefined) {
    writeFileSync(readmePath, backupReadme)
    rmSync(backupPath, { force: true })
  }

  const originalReadme = readFileIfExists(readmePath)

  if (originalReadme === undefined) {
    return
  }
  const rewrittenReadme = rewriteReadmeForPublish(
    originalReadme,
    getPublishReadmeConfig(resolvedPackageDir, overrides),
  )

  if (rewrittenReadme === originalReadme) {
    return
  }

  mkdirSync(path.dirname(backupPath), { recursive: true })
  writeFileSync(backupPath, originalReadme)
  writeFileSync(readmePath, rewrittenReadme)
}

export function restorePublishReadme(packageDir = '.'): void {
  const resolvedPackageDir = path.resolve(packageDir)
  const backupPath = getReadmeBackupPath(resolvedPackageDir)
  const originalReadme = readFileIfExists(backupPath)

  if (originalReadme === undefined) {
    return
  }

  writeFileSync(getReadmePath(resolvedPackageDir), originalReadme)
  rmSync(backupPath, { force: true })
}
