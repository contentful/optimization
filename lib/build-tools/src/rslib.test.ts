import { RsdoctorRspackPlugin } from '@rsdoctor/rspack-plugin'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { concatPolyfills, ensureUmdDefaultExport, maybeEnableRsDoctor } from './rslib'

describe('maybeEnableRsDoctor', () => {
  const originalRsDoctor = process.env.RSDOCTOR

  afterEach(() => {
    if (originalRsDoctor === undefined) {
      delete process.env.RSDOCTOR
      return
    }

    process.env.RSDOCTOR = originalRsDoctor
  })

  it('adds RsDoctor plugin when RSDOCTOR=true and plugins is an array', () => {
    process.env.RSDOCTOR = 'true'

    const config = { plugins: [] as unknown[], devtool: 'source-map' as unknown }

    maybeEnableRsDoctor(config)

    expect(config.plugins).toHaveLength(1)
    expect(config.plugins[0]).toBeInstanceOf(RsdoctorRspackPlugin)
  })

  it('does nothing when RSDOCTOR is not true', () => {
    process.env.RSDOCTOR = 'false'

    const config = { plugins: [] as unknown[] }

    maybeEnableRsDoctor(config)

    expect(config.plugins).toHaveLength(0)
  })

  it('does nothing when plugins is not an array', () => {
    process.env.RSDOCTOR = 'true'

    expect(() => {
      maybeEnableRsDoctor({})
    }).not.toThrow()
    expect(() => {
      maybeEnableRsDoctor({ plugins: {} })
    }).not.toThrow()
  })

  it('disables devtool to prevent repeated Rsdoctor warning noise', () => {
    process.env.RSDOCTOR = 'true'

    const config: {
      plugins: unknown[]
      devtool?: unknown
    } = { plugins: [] as unknown[] }

    maybeEnableRsDoctor(config)
  })
})

describe('ensureUmdDefaultExport', () => {
  it('sets library.export to default for UMD builds', () => {
    const config = {
      output: {
        library: {
          type: 'umd',
        },
      },
    }

    ensureUmdDefaultExport(config)

    expect(config.output.library).toEqual({
      type: 'umd',
      export: 'default',
    })
  })

  it('does not change library export for non-UMD builds', () => {
    const config = {
      output: {
        library: {
          type: 'module',
        },
      },
    }

    ensureUmdDefaultExport(config)

    expect(config.output.library).toEqual({
      type: 'module',
    })
  })

  it('does not throw for malformed configs', () => {
    expect(() => {
      ensureUmdDefaultExport({})
    }).not.toThrow()
    expect(() => {
      ensureUmdDefaultExport({ output: null })
    }).not.toThrow()
    expect(() => {
      ensureUmdDefaultExport({ output: { library: null } })
    }).not.toThrow()
  })
})

describe('concatPolyfills', () => {
  it('reads files in the requested order and joins them with a newline-semicolon separator', () => {
    const dir = mkdtempSync(join(tmpdir(), 'build-tools-concat-polyfills-'))

    try {
      writeFileSync(join(dir, 'a.js'), 'var a = 1', 'utf8')
      writeFileSync(join(dir, 'b.js'), 'var b = 2', 'utf8')

      expect(concatPolyfills(dir, ['a', 'b'])).toBe('var a = 1\n;\nvar b = 2')
      expect(concatPolyfills(dir, ['b', 'a'])).toBe('var b = 2\n;\nvar a = 1')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
