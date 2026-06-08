import { getCookie, removeCookie, setCookie } from './cookies'

const setCookieJar = (value: string): void => {
  Object.defineProperty(document, 'cookie', {
    configurable: true,
    get: () => value,
    set: () => undefined,
  })
}

afterEach(() => {
  rs.restoreAllMocks()
  rs.unstubAllGlobals()
  rs.useRealTimers()
})

describe('getCookie', () => {
  it('returns the matching cookie value when present', () => {
    setCookieJar('foo=bar; baz=qux')

    expect(getCookie('baz')).toBe('qux')
  })

  it('returns undefined when cookie is missing', () => {
    setCookieJar('foo=bar')

    expect(getCookie('missing')).toBeUndefined()
  })

  it('returns undefined when document.cookie is empty', () => {
    setCookieJar('')

    expect(getCookie('foo')).toBeUndefined()
  })

  it('returns undefined in SSR environments where document is undefined', () => {
    rs.stubGlobal('document', undefined)

    expect(getCookie('foo')).toBeUndefined()
  })
})

describe('setCookie', () => {
  it('writes a cookie with Path=/ by default', () => {
    let written = ''
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get: () => '',
      set: (value: string) => {
        written = value
      },
    })

    setCookie('foo', 'bar')

    expect(written).toBe('foo=bar; Path=/')
  })

  it('appends Expires when expires is a finite number of days', () => {
    rs.useFakeTimers()
    rs.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
    let written = ''
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get: () => '',
      set: (value: string) => {
        written = value
      },
    })

    setCookie('foo', 'bar', { expires: 1 })

    expect(written).toContain('foo=bar; Path=/')
    expect(written).toContain(`Expires=${new Date('2026-01-02T00:00:00.000Z').toUTCString()}`)
  })

  it('skips Expires when value is not finite', () => {
    let written = ''
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get: () => '',
      set: (value: string) => {
        written = value
      },
    })

    setCookie('foo', 'bar', { expires: Number.POSITIVE_INFINITY })

    expect(written).toBe('foo=bar; Path=/')
  })

  it('appends Domain when provided', () => {
    let written = ''
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get: () => '',
      set: (value: string) => {
        written = value
      },
    })

    setCookie('foo', 'bar', { domain: 'example.com' })

    expect(written).toBe('foo=bar; Path=/; Domain=example.com')
  })

  it('is a no-op in SSR environments where document is undefined', () => {
    rs.stubGlobal('document', undefined)

    expect(() => {
      setCookie('foo', 'bar')
    }).not.toThrow()
  })
})

describe('removeCookie', () => {
  it('writes an expired cookie at the epoch', () => {
    let written = ''
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get: () => '',
      set: (value: string) => {
        written = value
      },
    })

    removeCookie('foo')

    expect(written).toBe('foo=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/')
  })

  it('appends Domain when provided', () => {
    let written = ''
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get: () => '',
      set: (value: string) => {
        written = value
      },
    })

    removeCookie('foo', { domain: 'example.com' })

    expect(written).toBe('foo=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; Domain=example.com')
  })

  it('is a no-op in SSR environments where document is undefined', () => {
    rs.stubGlobal('document', undefined)

    expect(() => {
      removeCookie('foo')
    }).not.toThrow()
  })
})
