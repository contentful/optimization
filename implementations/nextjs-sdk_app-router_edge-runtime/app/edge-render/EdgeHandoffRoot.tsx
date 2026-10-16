'use client'

import { appConfig } from '@/lib/config'
import {
  OptimizationRoot,
  useConsentState,
  useEventStreamState,
  useOptimizationActions,
  type OptimizationRootProps,
} from '@contentful/optimization-nextjs/client'
import { useEffect, useSyncExternalStore, type ReactNode } from 'react'

const subscribeToMount = (): (() => void) => () => undefined
const isMounted = (): boolean => true
const isServer = (): boolean => false

function hasBrowserConsent(): boolean {
  return document.cookie
    .split(';')
    .some((part) => part.trim() === 'app-personalization-consent=granted')
}

function EdgeControls() {
  const consent = useConsentState()
  const latestEvent = useEventStreamState()
  const { setConsent } = useOptimizationActions()
  const mounted = useSyncExternalStore(subscribeToMount, isMounted, isServer)

  useEffect(() => {
    const granted = hasBrowserConsent()
    if (consent !== granted) setConsent(granted)
  }, [consent, setConsent])

  if (!mounted) return null

  return (
    <section aria-label="Personalization controls">
      <p data-testid="edge-consent-status">Consent: {consent === true ? 'Yes' : 'No'}</p>
      <p data-testid="edge-last-event">Latest event: {latestEvent?.type ?? 'None'}</p>
      <button
        onClick={() => {
          document.cookie = 'app-personalization-consent=granted; Path=/; SameSite=Lax'
          setConsent(true)
        }}
        type="button"
      >
        Grant personalization consent
      </button>
    </section>
  )
}

export function EdgeHandoffRoot({
  children,
  consent,
  handoff,
  routeKey,
}: {
  readonly children: ReactNode
  readonly consent: boolean
  readonly handoff: NonNullable<OptimizationRootProps['handoff']>
  readonly routeKey: string
}) {
  const initialConsent = typeof document === 'undefined' ? consent : hasBrowserConsent()

  return (
    <OptimizationRoot
      api={appConfig.api}
      defaults={{ consent: initialConsent, persistenceConsent: initialConsent }}
      environment={appConfig.environment}
      handoff={handoff}
      locale={appConfig.locale}
      routeKey={routeKey}
      spaceId={appConfig.spaceId}
    >
      {children}
      <EdgeControls />
    </OptimizationRoot>
  )
}
