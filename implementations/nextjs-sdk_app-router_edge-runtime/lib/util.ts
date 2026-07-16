import { appConfig } from './config'

export function getAppConsent(cookies: { get(i: string): { value: string } | undefined }): boolean {
  return cookies.get(appConfig.personalizationConsentCookie)?.value === 'granted'
}
