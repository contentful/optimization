import {
  OptimizationRoot,
  OptimizedEntry,
  useOptimizationContext,
} from '@contentful/optimization-react-web'
import type { ContentOptimizationHandoff } from '@contentful/optimization-react-web/handoff'
import { useEffect, useState, type ReactElement } from 'react'
import { CONSENT_COOKIE, optimizationConfig } from '../lib/config'
import type { ContentEntry } from '../lib/content'

interface Props {
  baselineEntry: ContentEntry
  handoff?: ContentOptimizationHandoff
  routeKey: string
}

interface ExperienceProps extends Props {
  events: readonly string[]
}

function Experience({ baselineEntry, handoff, routeKey, events }: ExperienceProps): ReactElement {
  const { sdk, isLive, error } = useOptimizationContext()
  const [actionError, setActionError] = useState<string>()

  useEffect(() => {
    if (!isLive || !sdk) return
    // The root owns prepared replay; ordinary full-page loads need an explicit page owner.
    if (!handoff) {
      void sdk
        .trackCurrentPage({
          routeKey: window.location.pathname + window.location.search,
          buildPayload: () => ({ properties: { url: window.location.href } }),
        })
        .catch((cause: unknown) => {
          setActionError(String(cause))
        })
    }
  }, [handoff, isLive, routeKey, sdk])

  const changeConsent = (granted: boolean): void => {
    if (!isLive || !sdk) return
    sdk.consent(granted)
    if (!granted) sdk.reset()
    const secure = window.location.protocol === 'https:' ? '; Secure' : ''
    document.cookie = `${CONSENT_COOKIE}=${granted ? 'granted' : 'denied'}; Path=/; SameSite=Lax${secure}`
    window.location.reload()
  }

  const identify = async (): Promise<void> => {
    if (!isLive || !sdk) return
    try {
      await sdk.identify({ userId: 'astro-explorer', traits: { identified: true } })
    } catch (cause: unknown) {
      setActionError(String(cause))
    }
  }

  const track = async (): Promise<void> => {
    if (!isLive || !sdk) return
    try {
      await sdk.track({ event: 'Astro CTA clicked' })
      await sdk.flush()
    } catch (cause: unknown) {
      setActionError(String(cause))
    }
  }

  if (error) return <p role="alert">Optimization initialization failed: {error.message}</p>

  return (
    <section aria-label="Personalization">
      <p role="status">{isLive ? 'Optimization ready' : 'Server snapshot'}</p>
      <OptimizedEntry baselineEntry={baselineEntry} clickable liveUpdates>
        {(entry) => (
          <article data-testid="personalized-entry">
            <p>{typeof entry.fields.text === 'string' ? entry.fields.text : 'No text field'}</p>
            <button
              type="button"
              disabled={!isLive}
              onClick={() => {
                void track()
              }}
            >
              Explore this offer
            </button>
          </article>
        )}
      </OptimizedEntry>
      <div className="controls">
        <button
          type="button"
          disabled={!isLive}
          onClick={() => {
            changeConsent(true)
          }}
        >
          Allow personalization and analytics
        </button>
        <button
          type="button"
          disabled={!isLive}
          onClick={() => {
            changeConsent(false)
          }}
        >
          Withdraw consent
        </button>
        <button
          type="button"
          disabled={!isLive}
          onClick={() => {
            void identify()
          }}
        >
          Identify example visitor
        </button>
      </div>
      {actionError ? <p role="alert">{actionError}</p> : null}
      <p>Accepted SDK events on this page (delivery is checked separately):</p>
      <output data-testid="events">{events.join(', ') || 'None'}</output>
    </section>
  )
}

export default function Personalization(props: Props): ReactElement {
  const [events, setEvents] = useState<string[]>([])
  // Browser consent must be known at construction, before storage continuity is loaded or cleared.
  const consent =
    typeof document === 'undefined'
      ? props.handoff !== undefined
      : document.cookie.split('; ').includes(`${CONSENT_COOKIE}=granted`)
  return (
    <OptimizationRoot
      {...optimizationConfig}
      defaults={{
        consent,
        persistenceConsent: consent,
      }}
      handoff={props.handoff}
      routeKey={props.routeKey}
      liveUpdates
      onStatesReady={(states) => {
        const subscription = states.eventStream.subscribe((event) => {
          if (event) setEvents((previous) => [...previous, event.type])
        })
        return () => {
          subscription.unsubscribe()
        }
      }}
    >
      <Experience {...props} events={events} />
    </OptimizationRoot>
  )
}
