import { appConfig } from './config'

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function toIdMap<T extends { sys: { id: string } }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.sys.id, item]))
}

export function setAppConsent(consented: boolean): void {
  const value = consented ? 'granted' : 'denied'
  document.cookie = `${appConfig.personalizationConsentCookie}=${value}; Path=/; SameSite=Lax`
}

export function getAppConsent(cookies: { get(i: string): { value: string } | undefined }): boolean {
  return cookies.get(appConfig.personalizationConsentCookie)?.value === 'granted'
}
