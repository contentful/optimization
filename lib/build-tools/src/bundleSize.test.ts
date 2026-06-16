import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { checkBundleSize } from './bundleSize'

describe('checkBundleSize', () => {
  it('measures configured bundle files and reports failures when budgets are exceeded', () => {
    const packageDir = mkdtempSync(join(tmpdir(), 'build-tools-bundle-size-'))
    const distDir = join(packageDir, 'dist')
    const indexContents = 'export const indexValue = "hello world";'
    const loggerContents = 'export const loggerValue = "logger";'
    const indexGzipBytes = gzipSync(Buffer.from(indexContents), { level: 9 }).byteLength
    const loggerGzipBytes = gzipSync(Buffer.from(loggerContents), { level: 9 }).byteLength

    try {
      mkdirSync(distDir)
      writeFileSync(
        join(packageDir, 'package.json'),
        JSON.stringify({
          buildTools: {
            bundleSize: {
              gzipBudgets: {
                'index.mjs': indexGzipBytes,
                'logger.mjs': loggerGzipBytes - 1,
              },
            },
          },
        }),
      )
      writeFileSync(join(distDir, 'index.mjs'), indexContents)
      writeFileSync(join(distDir, 'logger.mjs'), loggerContents)

      const { failures, results } = checkBundleSize({ packageDir })

      expect(results).toEqual([
        {
          files: ['index.mjs'],
          file: 'index.mjs',
          rawBytes: Buffer.byteLength(indexContents),
          gzipBytes: indexGzipBytes,
          budgetBytes: indexGzipBytes,
        },
        {
          files: ['logger.mjs'],
          file: 'logger.mjs',
          rawBytes: Buffer.byteLength(loggerContents),
          gzipBytes: loggerGzipBytes,
          budgetBytes: loggerGzipBytes - 1,
        },
      ])
      expect(failures).toEqual([
        {
          file: 'logger.mjs',
          gzipBytes: loggerGzipBytes,
          budgetBytes: loggerGzipBytes - 1,
          overBytes: 1,
        },
      ])
    } finally {
      rmSync(packageDir, { force: true, recursive: true })
    }
  })

  it('includes local chunks reachable from configured JavaScript entries', () => {
    const packageDir = mkdtempSync(join(tmpdir(), 'build-tools-bundle-size-'))
    const distDir = join(packageDir, 'dist')
    const indexContents =
      'import"./shared.mjs";export{value}from"./feature.mjs";require("./cjs.cjs");'
    const sharedContents = 'export const shared = "shared";'
    const featureContents = 'import "./shared.mjs"; export const value = "feature";'
    const cjsContents = 'require("./leaf.js"); exports.value = "cjs";'
    const leafContents = 'export const leaf = "leaf";'
    const expectedRawBytes =
      Buffer.byteLength(indexContents) +
      Buffer.byteLength(sharedContents) +
      Buffer.byteLength(featureContents) +
      Buffer.byteLength(cjsContents) +
      Buffer.byteLength(leafContents)
    const expectedGzipBytes =
      gzipSync(Buffer.from(indexContents), { level: 9 }).byteLength +
      gzipSync(Buffer.from(sharedContents), { level: 9 }).byteLength +
      gzipSync(Buffer.from(featureContents), { level: 9 }).byteLength +
      gzipSync(Buffer.from(cjsContents), { level: 9 }).byteLength +
      gzipSync(Buffer.from(leafContents), { level: 9 }).byteLength

    try {
      mkdirSync(distDir)
      writeFileSync(
        join(packageDir, 'package.json'),
        JSON.stringify({
          buildTools: {
            bundleSize: {
              gzipBudgets: {
                'index.mjs': expectedGzipBytes,
              },
            },
          },
        }),
      )
      writeFileSync(join(distDir, 'index.mjs'), indexContents)
      writeFileSync(join(distDir, 'shared.mjs'), sharedContents)
      writeFileSync(join(distDir, 'feature.mjs'), featureContents)
      writeFileSync(join(distDir, 'cjs.cjs'), cjsContents)
      writeFileSync(join(distDir, 'leaf.js'), leafContents)

      const { failures, results } = checkBundleSize({ packageDir })

      expect(results).toEqual([
        {
          budgetBytes: expectedGzipBytes,
          file: 'index.mjs',
          files: ['index.mjs', 'shared.mjs', 'feature.mjs', 'cjs.cjs', 'leaf.js'],
          gzipBytes: expectedGzipBytes,
          rawBytes: expectedRawBytes,
        },
      ])
      expect(failures).toEqual([])
    } finally {
      rmSync(packageDir, { force: true, recursive: true })
    }
  })

  it('suppresses failures in report-only mode', () => {
    const packageDir = mkdtempSync(join(tmpdir(), 'build-tools-bundle-size-'))
    const distDir = join(packageDir, 'dist')

    try {
      mkdirSync(distDir)
      writeFileSync(
        join(packageDir, 'package.json'),
        JSON.stringify({
          buildTools: {
            bundleSize: {
              gzipBudgets: {
                'index.mjs': 1,
              },
            },
          },
        }),
      )
      writeFileSync(join(distDir, 'index.mjs'), 'export const value = "hello";')

      const { failures, results } = checkBundleSize({ packageDir, reportOnly: true })

      expect(results).toHaveLength(1)
      expect(failures).toEqual([])
    } finally {
      rmSync(packageDir, { force: true, recursive: true })
    }
  })

  it('throws when gzip budgets are not configured', () => {
    const packageDir = mkdtempSync(join(tmpdir(), 'build-tools-bundle-size-'))

    try {
      writeFileSync(join(packageDir, 'package.json'), JSON.stringify({ name: 'example-package' }))

      expect(() => {
        checkBundleSize({ packageDir })
      }).toThrow(
        `Missing buildTools.bundleSize.gzipBudgets in ${join(packageDir, 'package.json')}. Configure per-file gzip budgets before running bundle-size checks.`,
      )
    } finally {
      rmSync(packageDir, { force: true, recursive: true })
    }
  })
})
