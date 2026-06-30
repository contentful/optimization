import { appConfig } from './config'
import type { ContentEntry } from './contentful'

export function setAppConsent(consented: boolean): void {
  const value = consented ? 'granted' : 'denied'
  document.cookie = `${appConfig.personalizationConsentCookie}=${value}; Path=/; SameSite=Lax`
}

export function getAppConsent(cookies: { get(i: string): { value: string } | undefined }): boolean {
  return cookies.get(appConfig.personalizationConsentCookie)?.value === 'granted'
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function isEntry(value: unknown): value is ContentEntry {
  return (
    isRecord(value) &&
    isRecord(value.sys) &&
    typeof value.sys.id === 'string' &&
    isRecord(value.fields)
  )
}
