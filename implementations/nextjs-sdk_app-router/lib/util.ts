import { appConfig } from './config'

export function toIdMap<T extends { sys: { id: string } }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.sys.id, item]))
}

export function setAppConsent(consented: boolean): void {
  const value = consented ? 'granted' : 'denied'
  document.cookie = `${appConfig.personalizationConsentCookie}=${value}; Path=/; SameSite=Lax`
}

export function getBrowserAppConsent(): boolean | undefined {
  if (typeof document === 'undefined') return undefined

  const prefix = `${appConfig.personalizationConsentCookie}=`
  const value = document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith(prefix))
    ?.slice(prefix.length)

  if (value === 'granted') return true
  if (value === 'denied') return false

  return undefined
}

export function getAppConsent(cookies: { get(i: string): { value: string } | undefined }): boolean {
  return cookies.get(appConfig.personalizationConsentCookie)?.value === 'granted'
}
