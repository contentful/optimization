import { createPageContextFromUrl, createQueryFromSearchParams } from './page-context'

describe('createQueryFromSearchParams', () => {
  it('maps a key that appears once to its value', () => {
    expect(createQueryFromSearchParams(new URLSearchParams('utm_source=newsletter'))).toEqual({
      utm_source: 'newsletter',
    })
  })

  it('maps a repeated key to all of its values in order', () => {
    expect(createQueryFromSearchParams(new URLSearchParams('tag=a&tag=b&tag=c'))).toEqual({
      tag: ['a', 'b', 'c'],
    })
  })

  it('returns an empty query for no parameters', () => {
    expect(createQueryFromSearchParams(new URLSearchParams(''))).toEqual({})
  })
})

describe('createPageContextFromUrl', () => {
  it('keeps every value of a repeated query key', () => {
    expect(createPageContextFromUrl('https://example.com/shop?tag=a&tag=b&sort=asc').query).toEqual(
      {
        tag: ['a', 'b'],
        sort: 'asc',
      },
    )
  })
})
