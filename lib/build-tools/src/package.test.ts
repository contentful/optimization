import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getPackageName, hasPackageName } from './package'

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
