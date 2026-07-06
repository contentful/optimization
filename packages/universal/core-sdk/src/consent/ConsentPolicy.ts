import type { AllowedEventType } from '../events'

export const UNLOCKING_EVENT_TYPES: readonly AllowedEventType[] = [
  'identify',
  'page',
  'screen',
  'track',
  'group',
  'alias',
  'component',
]

export const hasEventConsent = (
  method: string,
  consent: boolean | undefined,
  allowedEventTypes: readonly AllowedEventType[],
): boolean => {
  if (consent === true) return true

  if (method === 'trackView') return allowedEventTypes.includes('component')
  if (method === 'trackFlagView') {
    return allowedEventTypes.includes('flag') || allowedEventTypes.includes('component')
  }
  if (method === 'trackClick') return allowedEventTypes.includes('component_click')
  if (method === 'trackHover') return allowedEventTypes.includes('component_hover')

  return allowedEventTypes.some((eventType) => eventType === method)
}
