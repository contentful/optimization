'use client'

import { useOptimizationContext } from '@contentful/optimization-react-web'
import type { Profile } from '@contentful/optimization-react-web/api-schemas'
import { type JSX, useEffect, useMemo, useState } from 'react'

export function InteractiveControls(): JSX.Element {
  const { sdk, isReady } = useOptimizationContext()
  const [consent, setConsent] = useState<boolean | undefined>(undefined)
  const [profile, setProfile] = useState<Profile | undefined>(undefined)

  useEffect(() => {
    if (!sdk || !isReady) {
      return
    }

    const consentSub = sdk.states.consent.subscribe((value: boolean | undefined) => {
      setConsent(value)
    })

    const profileSub = sdk.states.profile.subscribe((value: Profile | undefined) => {
      setProfile(value)
    })

    return () => {
      consentSub.unsubscribe()
      profileSub.unsubscribe()
    }
  }, [isReady, sdk])

  const isIdentified = useMemo(
    () => profile !== undefined && Boolean(profile.traits.identified),
    [profile],
  )

  if (!sdk || !isReady) {
    return (
      <section className="rounded-lg border border-zinc-200 p-4">
        <p className="text-sm text-zinc-400">SDK loading...</p>
      </section>
    )
  }

  return (
    <section className="rounded-lg border border-zinc-200 p-4">
      <h2 className="text-lg font-medium mb-3">Controls</h2>
      <div className="flex gap-3 flex-wrap">
        <button
          data-testid="consent-button"
          onClick={() => {
            sdk.consent(consent !== true)
          }}
          type="button"
          className="rounded border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50"
        >
          {consent === true ? 'Reject Consent' : 'Accept Consent'}
        </button>

        {!isIdentified ? (
          <button
            data-testid="identify-button"
            onClick={() => {
              void sdk.identify({ userId: 'charles', traits: { identified: true } })
            }}
            type="button"
            className="rounded border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50"
          >
            Identify
          </button>
        ) : (
          <button
            data-testid="reset-button"
            onClick={() => {
              sdk.reset()
            }}
            type="button"
            className="rounded border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50"
          >
            Reset Profile
          </button>
        )}
      </div>

      <div className="mt-3 text-sm text-zinc-500 space-y-1">
        <p data-testid="consent-status">Consent: {String(consent)}</p>
        <p data-testid="identified-status">Identified: {isIdentified ? 'Yes' : 'No'}</p>
      </div>
    </section>
  )
}
