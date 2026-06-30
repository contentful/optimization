import { appConfig } from './config'

export function setAppConsent(consented: boolean): void {
  const value = consented ? 'granted' : 'denied'
  document.cookie = `${appConfig.personalizationConsentCookie}=${value}; Path=/; SameSite=Lax`
}

export function getAppConsent(cookies: { get(i: string): { value: string } | undefined }): boolean {
  return cookies.get(appConfig.personalizationConsentCookie)?.value === 'granted'
}
