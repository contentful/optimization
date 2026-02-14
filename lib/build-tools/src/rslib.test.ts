import { RsdoctorRspackPlugin } from '@rsdoctor/rspack-plugin'
import { ensureUmdDefaultExport, maybeEnableRsDoctor } from './rslib'

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

    const config = { plugins: [] as unknown[] }

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
