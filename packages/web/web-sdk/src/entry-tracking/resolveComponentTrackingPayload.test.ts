import {
  isEntryData,
  isEntryElement,
  resolveComponentTrackingPayload,
} from './resolveComponentTrackingPayload'

describe('resolveComponentTrackingPayload', () => {
  it('resolves tracking payload from element dataset', () => {
    const element = document.createElement('div')
    element.dataset.ctflEntryId = 'entry-1'
    element.dataset.ctflPersonalizationId = 'exp-1'
    element.dataset.ctflSticky = 'TrUe'
    element.dataset.ctflVariantIndex = '7'

    expect(resolveComponentTrackingPayload(undefined, element)).toEqual({
      componentId: 'entry-1',
      experienceId: 'exp-1',
      sticky: true,
      variantIndex: 7,
    })
  })

  it('prefers explicit entry data over dataset values', () => {
    const element = document.createElement('div')
    element.dataset.ctflEntryId = 'dataset-id'
    element.dataset.ctflPersonalizationId = 'dataset-exp'
    element.dataset.ctflSticky = 'true'
    element.dataset.ctflVariantIndex = '4'

    const explicit = {
      entryId: 'manual-id',
      personalizationId: 'manual-exp',
      sticky: false,
      variantIndex: 2,
    }

    expect(resolveComponentTrackingPayload(explicit, element)).toEqual({
      componentId: 'manual-id',
      experienceId: 'manual-exp',
      sticky: false,
      variantIndex: 2,
    })
  })

  it('falls back to dataset when explicit data is invalid', () => {
    const element = document.createElement('div')
    element.dataset.ctflEntryId = 'entry-from-dataset'

    expect(resolveComponentTrackingPayload({ entryId: '  ' }, element)).toEqual({
      componentId: 'entry-from-dataset',
      experienceId: undefined,
      sticky: false,
      variantIndex: undefined,
    })
  })

  it('treats non-true sticky values as false and non-digit variant values as undefined', () => {
    const element = document.createElement('div')
    element.dataset.ctflEntryId = 'entry-2'
    element.dataset.ctflSticky = 'yes'
    element.dataset.ctflVariantIndex = '7x'

    expect(resolveComponentTrackingPayload(undefined, element)).toEqual({
      componentId: 'entry-2',
      experienceId: undefined,
      sticky: false,
      variantIndex: undefined,
    })
  })

  it('ignores variant indexes larger than Number.MAX_SAFE_INTEGER', () => {
    const element = document.createElement('div')
    element.dataset.ctflEntryId = 'entry-3'
    element.dataset.ctflVariantIndex = '9007199254740992'

    const payload = resolveComponentTrackingPayload(undefined, element)

    expect(payload).toEqual({
      componentId: 'entry-3',
      experienceId: undefined,
      sticky: false,
      variantIndex: undefined,
    })
  })

  it('returns undefined when no valid entry data source is available', () => {
    const element = document.createElement('div')

    expect(resolveComponentTrackingPayload(undefined, element)).toBeUndefined()
  })
})

describe('isEntryElement', () => {
  it('returns true for elements with non-empty ctflEntryId', () => {
    const element = document.createElement('div')
    element.dataset.ctflEntryId = 'entry-ok'

    expect(isEntryElement(element)).toBe(true)
  })

  it('returns false for missing or empty ctflEntryId', () => {
    const missing = document.createElement('div')
    const empty = document.createElement('div')
    empty.dataset.ctflEntryId = '   '

    expect(isEntryElement(missing)).toBe(false)
    expect(isEntryElement(empty)).toBe(false)
  })

  it('returns false for non-element inputs', () => {
    expect(isEntryElement()).toBe(false)
  })
})

describe('isEntryData', () => {
  it('returns true for valid entry data objects', () => {
    expect(isEntryData({ entryId: 'entry-valid' })).toBe(true)
  })

  it('returns false for invalid objects and non-objects', () => {
    expect(isEntryData({ entryId: '' })).toBe(false)
    expect(isEntryData({ entryId: '   ' })).toBe(false)
    expect(isEntryData({ nope: true })).toBe(false)
    expect(isEntryData('entry')).toBe(false)
    expect(isEntryData(undefined)).toBe(false)
  })
})
