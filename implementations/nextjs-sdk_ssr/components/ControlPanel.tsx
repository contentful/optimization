'use client'

import { APP_PERSONALIZATION_CONSENT_COOKIE } from '@/lib/config'
import {
  useConsentState,
  useOptimizationActions,
  useProfileState,
} from '@contentful/optimization-nextjs/client'
import { type JSX, useEffect, useMemo } from 'react'

function setAppConsentCookie(consented: boolean): void {
  const value = consented ? 'granted' : 'denied'
  document.cookie = `${APP_PERSONALIZATION_CONSENT_COOKIE}=${value}; Path=/; SameSite=Lax`
}

export function ControlPanel(): JSX.Element {
  const { consent: setConsent, identify, reset } = useOptimizationActions()
  const consent = useConsentState()
  const profile = useProfileState()

  useEffect(() => {
    if (typeof consent === 'boolean') setAppConsentCookie(consent)
  }, [consent])

  const isIdentified = useMemo(
    () => profile !== undefined && Boolean(profile.traits.identified),
    [profile],
  )

  return (
    <section className="control-panel" id="utility-panel">
      <h2 className="control-panel__title">Utilities</h2>
      <div className="control-panel__fields">
        <span className="control-panel__row-label">Consent</span>
        <span className="control-panel__row-value" data-testid="consent-status">
          {consent === true ? 'Yes' : consent === false ? 'No' : 'undefined'}
        </span>
        {consent === true ? (
          <button
            className="btn btn--danger btn--sm"
            data-testid="unconsent-button"
            onClick={() => {
              setConsent(false)
            }}
            type="button"
          >
            Revoke
          </button>
        ) : (
          <button
            className="btn btn--secondary btn--sm"
            data-testid="consent-button"
            onClick={() => {
              setConsent(true)
            }}
            type="button"
          >
            Grant
          </button>
        )}

        <span className="control-panel__row-label">Identified</span>
        <span className="control-panel__row-value" data-testid="identified-status">
          {isIdentified ? 'Yes' : 'No'}
        </span>
        {isIdentified ? (
          <button
            className="btn btn--danger btn--sm"
            data-testid="reset-button"
            onClick={() => {
              reset()
            }}
            type="button"
          >
            Reset
          </button>
        ) : (
          <button
            className="btn btn--secondary btn--sm"
            data-testid="identify-button"
            onClick={() => {
              void identify({ userId: 'charles', traits: { identified: true } })
            }}
            type="button"
          >
            Identify
          </button>
        )}
      </div>
    </section>
  )
}
