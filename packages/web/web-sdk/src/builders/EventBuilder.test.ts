import { getLocale, getPageProperties, getUserAgent } from './EventBuilder'

describe('EventBuilder', () => {
  afterEach(() => {
    rs.restoreAllMocks()
    rs.unstubAllGlobals()
    document.title = ''
    window.history.pushState({}, '', '/')
  })

  it('prefers the first locale from navigator.languages', () => {
    rs.spyOn(navigator, 'languages', 'get').mockReturnValue(['fr-CA', 'en-US'])
    rs.spyOn(navigator, 'language', 'get').mockReturnValue('en-US')

    expect(getLocale()).toBe('fr-CA')
  })

  it('falls back to navigator.language when languages is empty', () => {
    rs.spyOn(navigator, 'languages', 'get').mockReturnValue([])
    rs.spyOn(navigator, 'language', 'get').mockReturnValue('de-DE')

    expect(getLocale()).toBe('de-DE')
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
