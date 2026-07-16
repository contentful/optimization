import { readFileSync } from 'node:fs'

interface NextjsPackageManifest {
  readonly exports?: Record<string, unknown>
  readonly main?: unknown
  readonly module?: unknown
  readonly types?: unknown
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNextjsPackageManifest(value: unknown): value is NextjsPackageManifest {
  return isObjectRecord(value) && (value.exports === undefined || isObjectRecord(value.exports))
}

function readPackageManifest(): NextjsPackageManifest {
  const manifest = JSON.parse(readFileSync('package.json', 'utf8')) as unknown

  if (!isNextjsPackageManifest(manifest)) {
    throw new TypeError('package.json has an unexpected shape')
  }

  return manifest
}

describe('Next.js package manifest', () => {
  it('requires explicit subpath imports', () => {
    const manifest = readPackageManifest()

    expect(Object.hasOwn(manifest.exports ?? {}, '.')).toBe(false)
    expect(Object.hasOwn(manifest.exports ?? {}, './cache-middleware')).toBe(true)
    expect(manifest).not.toHaveProperty('main')
    expect(manifest).not.toHaveProperty('module')
    expect(manifest).not.toHaveProperty('types')
  })
})
