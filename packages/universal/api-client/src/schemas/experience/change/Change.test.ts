import { Change } from './Change'

describe('Change', () => {
  it('parses a Variable change', () => {
    const result = Change.safeParse({
      key: 'headline',
      type: 'Variable',
      value: 'Hello',
      meta: { experienceId: 'exp_1', variantIndex: 0 },
    })

    expect(result.success).toBe(true)
  })

  it('parses an Experience change', () => {
    const result = Change.safeParse({
      type: 'Experience',
      id: 'entry_1',
      variantId: 'variant_1',
      meta: { optimizationId: 'opt_1', variantIndex: 1 },
    })

    expect(result.success).toBe(true)
  })

  it('parses a Fragment change', () => {
    const result = Change.safeParse({
      type: 'Fragment',
      id: 'entry_2',
      variantId: 'variant_2',
      meta: { optimizationId: 'opt_2', variantIndex: 0 },
    })

    expect(result.success).toBe(true)
  })

  it('rejects an Experience change using the Variable meta shape', () => {
    const result = Change.safeParse({
      type: 'Experience',
      id: 'entry_1',
      variantId: 'variant_1',
      meta: { experienceId: 'exp_1', variantIndex: 1 },
    })

    expect(result.success).toBe(false)
  })
})
