import { getPageProperties, getUserAgent } from './EventBuilder'

describe('EventBuilder', () => {
  afterEach(() => {
    rs.restoreAllMocks()
    rs.unstubAllGlobals()
    document.title = ''
    window.history.pushState({}, '', '/')
  })

  it('collects page properties from window and document state', () => {
    document.title = 'Catalog page'
    window.history.pushState({}, '', '/catalog?sku=123&debug=true#item-123')

    const page = getPageProperties()

    expect(page.path).toBe('/catalog')
    expect(page.search).toBe('?sku=123&debug=true')
    expect(page.hash).toBe('#item-123')
    expect(page.query).toEqual({
      sku: '123',
      debug: 'true',
    })
    expect(page.title).toBe('Catalog page')
    expect(page.referrer).toBe(document.referrer)
    expect(page.url).toContain('/catalog?sku=123&debug=true#item-123')
    expect(page.width).toBe(window.innerWidth)
    expect(page.height).toBe(window.innerHeight)
  })

  it('returns fallback page data when URL parsing fails', () => {
    rs.spyOn(document, 'title', 'get').mockImplementation(() => {
      throw new Error('bad-title')
    })

    const page = getPageProperties()

    expect(page).toEqual({
      path: '',
      query: {},
      referrer: '',
      search: '',
      title: '',
      url: '',
    })
  })

  it('returns navigator user agent', () => {
    expect(getUserAgent()).toBe(navigator.userAgent)
  })
})
