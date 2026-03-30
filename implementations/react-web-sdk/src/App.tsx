import { useOptimizationContext } from '@contentful/optimization-react-web'
import type { Profile } from '@contentful/optimization-react-web/api-schemas'
import { type JSX, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import {
  ENTRY_IDS,
  LIVE_UPDATES_ENTRY_ID,
  PAGE_TWO_AUTO_ENTRY_ID,
  PAGE_TWO_MANUAL_ENTRY_ID,
} from './config/entries'
import { HOME_PATH, PAGE_TWO_PATH } from './config/routes'
import { fetchEntries, getContentfulConfigError } from './services/contentfulClient'
import type { ContentfulEntry } from './types/contentful'

function isIdentifiedProfile(profile: Profile | undefined): boolean {
  if (profile === undefined) {
    return false
  }

  const { traits } = profile
  return Boolean(traits.identified)
}

function hasEntries(entries: ContentfulEntry[]): boolean {
  return entries.length > 0
}

function toEntryMap(entries: ContentfulEntry[]): Map<string, ContentfulEntry> {
  return new Map(entries.map((entry) => [entry.sys.id, entry]))
}

export default function App(): JSX.Element {
  const { sdk, isReady, error } = useOptimizationContext()
  const location = useLocation()

  const [consent, setConsent] = useState<boolean | undefined>(undefined)
  const [profile, setProfile] = useState<Profile | undefined>(undefined)
  const [entries, setEntries] = useState<ContentfulEntry[]>([])
  const [entriesError, setEntriesError] = useState<string | null>(null)

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

  useEffect(() => {
    if (!sdk || !isReady || consent !== true || profile === undefined) {
      return
    }

    const sub = sdk.states.flag('boolean').subscribe(() => undefined)

    return () => {
      sub.unsubscribe()
    }
  }, [consent, profile?.id, isReady, sdk])

  useEffect(() => {
    if (!sdk || !isReady) {
      return
    }

    const configError = getContentfulConfigError()
    if (configError) {
      setEntriesError(configError)
      return
    }

    void fetchEntries(ENTRY_IDS)
      .then((nextEntries) => {
        setEntries(nextEntries)
        setEntriesError(
          nextEntries.length === 0
            ? 'No entries were loaded. Verify mock server and Contentful env configuration.'
            : null,
        )
      })
      .catch((fetchError: unknown) => {
        const message =
          fetchError instanceof Error ? fetchError.message : 'Unknown entry load error'
        setEntriesError(message)
      })
  }, [isReady, sdk])

  const isIdentified = useMemo(() => isIdentifiedProfile(profile), [profile])
  const entriesById = useMemo(() => toEntryMap(entries), [entries])
  const liveUpdatesBaselineEntry = entriesById.get(LIVE_UPDATES_ENTRY_ID)
  const hasPageTwoEntries =
    entriesById.has(PAGE_TWO_AUTO_ENTRY_ID) && entriesById.has(PAGE_TWO_MANUAL_ENTRY_ID)

  if (error) {
    return <p>{error.message}</p>
  }

  if (!sdk || !isReady) {
    return <p>Loading SDK...</p>
  }

  if (entriesError) {
    return <p>{entriesError}</p>
  }

  if (!hasEntries(entries)) {
    return <p>Loading entries...</p>
  }

  if (!liveUpdatesBaselineEntry) {
    return <p>Live updates baseline entry is missing from fetched entries.</p>
  }

  if (!hasPageTwoEntries) {
    return <p>Page Two demo entries are missing from fetched entries.</p>
  }

  const handleIdentify = (): void => {
    void sdk.identify({ userId: 'charles', traits: { identified: true } })
  }

  const handleReset = (): void => {
    sdk.reset()
  }

  const handleConsent = (accepted: boolean): void => {
    sdk.consent(accepted)
  }

  return (
    <main style={{ display: 'grid', gap: 24 }}>
      <nav style={{ display: 'flex', gap: 12 }}>
        <Link data-testid="link-home" to={HOME_PATH}>
          Home
        </Link>
        <Link data-testid="link-page-two" to={PAGE_TWO_PATH}>
          Go to Page Two
        </Link>
      </nav>

      <Routes>
        <Route
          path={HOME_PATH}
          element={
            <p data-testid="home-placeholder">
              {`Home page — entries: ${entries.length}, identified: ${String(isIdentified)}, current path: ${location.pathname}`}
            </p>
          }
        />
        <Route
          path={PAGE_TWO_PATH}
          element={
            <p data-testid="page-two-placeholder">
              {`Page Two — identified: ${String(isIdentified)}, consent: ${String(consent)}`}
            </p>
          }
        />
        <Route path="*" element={<Navigate replace to={HOME_PATH} />} />
      </Routes>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {consent === true ? (
          <button
            data-testid="unconsent-button"
            onClick={() => {
              handleConsent(false)
            }}
            type="button"
          >
            Reject Consent
          </button>
        ) : (
          <button
            data-testid="consent-button"
            onClick={() => {
              handleConsent(true)
            }}
            type="button"
          >
            Accept Consent
          </button>
        )}

        {!isIdentified ? (
          <button data-testid="live-updates-identify-button" onClick={handleIdentify} type="button">
            Identify
          </button>
        ) : (
          <button data-testid="live-updates-reset-button" onClick={handleReset} type="button">
            Reset Profile
          </button>
        )}
      </div>

      <p data-testid="consent-status">Consent: {String(consent)}</p>
      <p data-testid="identified-status">{isIdentified ? 'Yes' : 'No'}</p>
    </main>
  )
}
