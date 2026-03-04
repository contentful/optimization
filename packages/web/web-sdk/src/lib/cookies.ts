const EXPIRED_UTC = 'Thu, 01 Jan 1970 00:00:00 GMT'
const MS_IN_DAY = 86_400_000

interface CookieAttributes {
  domain?: string
  expires?: number
}

export const getCookie = (name: string): string | undefined => {
  if (typeof document === 'undefined') return undefined

  const prefix = `${name}=`
  const cookies = document.cookie ? document.cookie.split('; ') : []

  for (const cookie of cookies) {
    if (!cookie.startsWith(prefix)) continue
    return cookie.slice(prefix.length)
  }

  return undefined
}

export const setCookie = (name: string, value: string, attributes?: CookieAttributes): void => {
  if (typeof document === 'undefined') return

  let cookie = `${name}=${value}; Path=/`

  if (typeof attributes?.expires === 'number' && Number.isFinite(attributes.expires)) {
    cookie += `; Expires=${new Date(Date.now() + attributes.expires * MS_IN_DAY).toUTCString()}`
  }
  if (attributes?.domain) {
    cookie += `; Domain=${attributes.domain}`
  }

  document.cookie = cookie
}

export const removeCookie = (name: string, attributes?: Pick<CookieAttributes, 'domain'>): void => {
  if (typeof document === 'undefined') return

  document.cookie = `${name}=; Expires=${EXPIRED_UTC}; Path=/${
    attributes?.domain ? `; Domain=${attributes.domain}` : ''
  }`
}
