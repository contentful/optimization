import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { emitDualDts } from './emitDualDts'

describe('emitDualDts', () => {
  it('emits dual declarations for all root-level .d.ts files', () => {
    const distDir = mkdtempSync(join(tmpdir(), 'build-tools-emit-dual-dts-'))

    try {
      writeFileSync(join(distDir, 'index.d.ts'), 'export declare const indexValue: string')
      writeFileSync(join(distDir, 'constants.d.ts'), 'export declare const constantsValue: string')
      writeFileSync(join(distDir, 'index.d.ts.map'), '{}')

      mkdirSync(join(distDir, 'nested'))
      writeFileSync(
        join(distDir, 'nested', 'ignored.d.ts'),
        'export declare const ignoredValue: string',
      )

      emitDualDts(distDir)

      expect(readFileSync(join(distDir, 'index.d.mts'), 'utf8')).toBe(
        'export declare const indexValue: string',
      )
      expect(readFileSync(join(distDir, 'index.d.cts'), 'utf8')).toBe(
        'export declare const indexValue: string',
      )
      expect(readFileSync(join(distDir, 'constants.d.mts'), 'utf8')).toBe(
        'export declare const constantsValue: string',
      )
      expect(readFileSync(join(distDir, 'constants.d.cts'), 'utf8')).toBe(
        'export declare const constantsValue: string',
      )

      expect(existsSync(join(distDir, 'nested', 'ignored.d.mts'))).toBe(false)
      expect(existsSync(join(distDir, 'nested', 'ignored.d.cts'))).toBe(false)
    } finally {
      rmSync(distDir, { force: true, recursive: true })
    }
  })

  it('throws when no root-level .d.ts files exist', () => {
    const distDir = mkdtempSync(join(tmpdir(), 'build-tools-emit-dual-dts-'))

    try {
      mkdirSync(join(distDir, 'nested'))
      writeFileSync(
        join(distDir, 'nested', 'index.d.ts'),
        'export declare const nestedValue: string',
      )

      expect(() => {
        emitDualDts(distDir)
      }).toThrow(`Could not find generated declaration files in dist root: ${distDir}`)
    } finally {
      rmSync(distDir, { force: true, recursive: true })
    }
  })
})
