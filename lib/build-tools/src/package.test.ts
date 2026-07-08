import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getPackageName, getPackageVersion, hasPackageName, hasPackageVersion } from './package'

describe('hasPackageName', () => {
  it('returns true when name is a string', () => {
    expect(hasPackageName({ name: 'build-tools' })).toBe(true)
  })

  it('returns false when input is not an object with a string name', () => {
    expect(hasPackageName(undefined)).toBe(false)
    expect(hasPackageName(null)).toBe(false)
    expect(hasPackageName('build-tools')).toBe(false)
    expect(hasPackageName({})).toBe(false)
    expect(hasPackageName({ name: 123 })).toBe(false)
  })
})

describe('hasPackageVersion', () => {
  it('returns true when version is a string', () => {
    expect(hasPackageVersion({ version: '1.2.3' })).toBe(true)
  })

  it('returns false when input is not an object with a string version', () => {
    expect(hasPackageVersion(undefined)).toBe(false)
    expect(hasPackageVersion(null)).toBe(false)
    expect(hasPackageVersion('1.2.3')).toBe(false)
    expect(hasPackageVersion({})).toBe(false)
    expect(hasPackageVersion({ version: 123 })).toBe(false)
  })
})

describe('getPackageName', () => {
  it('returns package name from package.json when present', () => {
    const packageDir = mkdtempSync(join(tmpdir(), 'build-tools-test-'))

    try {
      writeFileSync(
        join(packageDir, 'package.json'),
        JSON.stringify({ name: '@contentful/example-package' }),
      )

      expect(getPackageName(packageDir, 'fallback-name')).toBe('@contentful/example-package')
    } finally {
      rmSync(packageDir, { force: true, recursive: true })
    }
  })

  it('returns fallback when package.json has no valid string name', () => {
    const packageDir = mkdtempSync(join(tmpdir(), 'build-tools-test-'))

    try {
      writeFileSync(join(packageDir, 'package.json'), JSON.stringify({ name: 123 }))

      expect(getPackageName(packageDir, 'fallback-name')).toBe('fallback-name')
    } finally {
      rmSync(packageDir, { force: true, recursive: true })
    }
  })
})

describe('getPackageVersion', () => {
  it('returns package version from package.json when present', () => {
    const packageDir = mkdtempSync(join(tmpdir(), 'build-tools-test-'))

    try {
      writeFileSync(join(packageDir, 'package.json'), JSON.stringify({ version: '1.2.3' }))

      expect(getPackageVersion(packageDir, '0.0.0')).toBe('1.2.3')
    } finally {
      rmSync(packageDir, { force: true, recursive: true })
    }
  })

  it('returns fallback when package.json has no valid string version', () => {
    const packageDir = mkdtempSync(join(tmpdir(), 'build-tools-test-'))

    try {
      writeFileSync(join(packageDir, 'package.json'), JSON.stringify({ version: 123 }))

      expect(getPackageVersion(packageDir, '0.0.0')).toBe('0.0.0')
    } finally {
      rmSync(packageDir, { force: true, recursive: true })
    }
  })
})
