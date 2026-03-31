import { useOptimizationContext } from '@contentful/optimization-react-web'
import type { Profile } from '@contentful/optimization-react-web/api-schemas'
import { type JSX, useEffect, useMemo, useState } from 'react'
import { Link, Outlet, useOutletContext } from 'react-router-dom'
import { AnalyticsEventDisplay } from './components/AnalyticsEventDisplay'
import { ENTRY_IDS, LIVE_UPDATES_ENTRY_ID } from './config/entries'
import { HOME_PATH, PAGE_TWO_PATH } from './config/routes'
import { fetchEntries, getContentfulConfigError } from './services/contentfulClient'
import type { ContentfulEntry } from './types/contentful'

interface OutletContext {
  onToggleGlobalLiveUpdates: () => void
}

export interface AppOutletContext {
  consent: boolean | undefined
  entriesById: Map<string, ContentfulEntry>
  isIdentified: boolean
  liveUpdatesBaselineEntry: ContentfulEntry | undefined
  selectedOptimizationCount: number
  onConsentChange: (accepted: boolean) => void
  onIdentify: () => void
  onReset: () => void
  onToggleGlobalLiveUpdates: () => void
}

function isIdentifiedProfile(profile: Profile | undefined): boolean {
  if (profile === undefined) {
    return false
  }

  return Boolean(profile.traits.identified)
}

function toEntryMap(entries: ContentfulEntry[]): Map<string, ContentfulEntry> {
  return new Map(entries.map((entry) => [entry.sys.id, entry]))
}

export default function App(): JSX.Element {
  const { sdk, isReady, error } = useOptimizationContext()
  const { onToggleGlobalLiveUpdates } = useOutletContext<OutletContext>()

  const [consent, setConsent] = useState<boolean | undefined>(undefined)
  const [profile, setProfile] = useState<Profile | undefined>(undefined)
  const [selectedOptimizationCount, setSelectedOptimizationCount] = useState(0)
  const [entries, setEntries] = useState<ContentfulEntry[]>([])

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

    const selectedOptSub = sdk.states.selectedOptimizations.subscribe((value) => {
      setSelectedOptimizationCount(Array.isArray(value) ? value.length : 0)
    })

    return () => {
      consentSub.unsubscribe()
      profileSub.unsubscribe()
      selectedOptSub.unsubscribe()
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
      return
    }

    void fetchEntries(ENTRY_IDS).then((nextEntries) => {
      setEntries(nextEntries)
    })
  }, [isReady, sdk])

  const isIdentified = useMemo(() => isIdentifiedProfile(profile), [profile])
  const entriesById = useMemo(() => toEntryMap(entries), [entries])
  const liveUpdatesBaselineEntry = entriesById.get(LIVE_UPDATES_ENTRY_ID)

  if (error) {
    return <p data-testid="sdk-error">{error.message}</p>
  }

  if (!sdk || !isReady) {
    return <p data-testid="sdk-loading">Loading SDK...</p>
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

  const appOutletContext: AppOutletContext = {
    consent,
    entriesById,
    isIdentified,
    liveUpdatesBaselineEntry,
    selectedOptimizationCount,
    onConsentChange: handleConsent,
    onIdentify: handleIdentify,
    onReset: handleReset,
    onToggleGlobalLiveUpdates,
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

      <Outlet context={appOutletContext} />
      <AnalyticsEventDisplay />
    </main>
  )
}
