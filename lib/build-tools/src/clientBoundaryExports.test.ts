import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { checkClientBoundaryExports } from './clientBoundaryExports'

describe('checkClientBoundaryExports', () => {
  it('reports files that combine a client directive with export all', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'build-tools-client-boundary-'))

    try {
      mkdirSync(join(cwd, 'src'))
      writeFileSync(join(cwd, 'src', 'client.ts'), "'use client'\nexport * from './runtime'\n")
      writeFileSync(join(cwd, 'src', 'safe.ts'), "export * from './runtime'\n")
      writeFileSync(join(cwd, 'src', 'types.d.ts'), "'use client'\nexport * from './runtime'\n")

      expect(checkClientBoundaryExports({ cwd, paths: ['./src'] })).toEqual([
        { file: 'src/client.ts' },
      ])
    } finally {
      rmSync(cwd, { force: true, recursive: true })
    }
  })

  it('detects minified emitted export all syntax', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'build-tools-client-boundary-'))

    try {
      mkdirSync(join(cwd, 'dist'))
      writeFileSync(join(cwd, 'dist', 'client.mjs'), '\'use client\';export*from"./runtime.mjs";')

      expect(checkClientBoundaryExports({ cwd, paths: ['./dist'] })).toEqual([
        { file: 'dist/client.mjs' },
      ])
    } finally {
      rmSync(cwd, { force: true, recursive: true })
    }
  })

  it('ignores client boundaries with named exports', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'build-tools-client-boundary-'))

    try {
      mkdirSync(join(cwd, 'src'))
      writeFileSync(
        join(cwd, 'src', 'client.ts'),
        "'use client'\nexport { value } from './runtime'\n",
      )

      expect(checkClientBoundaryExports({ cwd, paths: ['./src'] })).toEqual([])
    } finally {
      rmSync(cwd, { force: true, recursive: true })
    }
  })
})
