'use client'

import { useGlobalLiveUpdatesControls } from '@/components/GlobalLiveUpdatesProvider'
import {
  useConsentState,
  useLiveUpdates,
  useOptimizationActions,
  useProfileState,
  useSelectedOptimizationsState,
} from '@contentful/optimization-nextjs/client'
import { type JSX, useEffect, useMemo } from 'react'

const APP_PERSONALIZATION_CONSENT_COOKIE = 'app-personalization-consent'

function setAppConsentCookie(consented: boolean): void {
  const value = consented ? 'granted' : 'denied'
  document.cookie = `${APP_PERSONALIZATION_CONSENT_COOKIE}=${value}; Path=/; SameSite=Lax`
}

export function InteractiveControls(): JSX.Element {
  const { consent: setConsent, identify, reset } = useOptimizationActions()
  const consent = useConsentState()
  const profile = useProfileState()
  const selectedOptimizations = useSelectedOptimizationsState()
  const { globalLiveUpdates, onToggleGlobalLiveUpdates } = useGlobalLiveUpdatesControls()
  const { previewPanelVisible } = useLiveUpdates()

  useEffect(() => {
    if (typeof consent === 'boolean') {
      setAppConsentCookie(consent)
    }
  }, [consent])

  const isIdentified = useMemo(
    () => profile !== undefined && Boolean(profile.traits.identified),
    [profile],
  )

  return (
    <section className="rounded-lg border border-zinc-200 p-4">
      <h2 className="text-lg font-medium mb-3">Utilities</h2>
      <div className="flex gap-3 flex-wrap">
        <button
          data-testid="consent-button"
          onClick={() => {
            setConsent(consent !== true)
          }}
          type="button"
          className="rounded border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50"
        >
          {consent === true ? 'Reject Consent' : 'Accept Consent'}
        </button>

        {!isIdentified ? (
          <button
            data-testid="live-updates-identify-button"
            onClick={() => {
              void identify({ userId: 'charles', traits: { identified: true } })
            }}
            type="button"
            className="rounded border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50"
          >
            Identify
          </button>
        ) : (
          <button
            data-testid="live-updates-reset-button"
            onClick={() => {
              reset()
            }}
            type="button"
            className="rounded border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50"
          >
            Reset Profile
          </button>
        )}

        <button
          data-testid="toggle-global-live-updates-button"
          onClick={onToggleGlobalLiveUpdates}
          type="button"
          className="rounded border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50"
        >
          {`Global: ${globalLiveUpdates ? 'ON' : 'OFF'}`}
        </button>
      </div>

      <div className="mt-3 text-sm text-zinc-500 space-y-1">
        <p data-testid="consent-status">Consent: {String(consent)}</p>
        <p data-testid="selected-optimizations-count">
          Selected Optimizations: {selectedOptimizations?.length ?? 0}
        </p>
        <p data-testid="identified-status">{isIdentified ? 'Yes' : 'No'}</p>
        <p data-testid="global-live-updates-status">{globalLiveUpdates ? 'ON' : 'OFF'}</p>
        <p data-testid="preview-panel-status">{previewPanelVisible ? 'Open' : 'Closed'}</p>
      </div>
    </section>
  )
}
