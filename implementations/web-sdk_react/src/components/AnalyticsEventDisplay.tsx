import { type JSX, useEffect, useReducer, useRef, useState } from 'react'
import { useOptimization } from '../optimization/hooks/useOptimization'
import { isRecord } from '../utils/typeGuards'

const MS_PER_SECOND = 1000
const SECONDS_PER_MINUTE = 60
const MINUTES_PER_HOUR = 60
const TICK_INTERVAL_SECONDS = 5

function timeAgo(firedAt: number): string {
  const s = Math.floor((Date.now() - firedAt) / MS_PER_SECOND)
  if (s < SECONDS_PER_MINUTE) return `${s}s`
  const m = Math.floor(s / SECONDS_PER_MINUTE)
  if (m < MINUTES_PER_HOUR) return `${m}m`
  return `${Math.floor(m / MINUTES_PER_HOUR)}h`
}

interface AnalyticsEvent {
  id: string
  componentId?: string
  firedAt: number
  hoverId?: string
  viewId?: string
  hoverDurationMs?: number
  pageUrl?: string
  type: string
  viewDurationMs?: number
}

function toPageUrl(event: Record<string, unknown>): string | undefined {
  const { properties } = event
  if (!isRecord(properties)) {
    return undefined
  }

  const { url } = properties
  if (typeof url !== 'string' || url.length === 0) {
    return undefined
  }

  try {
    const normalized = new URL(url, window.location.origin)
    return normalized.pathname
  } catch {
    return url
  }
}

function toAnalyticsEvent(event: unknown, id: string): AnalyticsEvent | undefined {
  if (!isRecord(event) || typeof event.type !== 'string') {
    return undefined
  }

  const componentId = typeof event.componentId === 'string' ? event.componentId : undefined
  const hoverId = typeof event.hoverId === 'string' ? event.hoverId : undefined
  const viewId = typeof event.viewId === 'string' ? event.viewId : undefined
  const hoverDurationMs =
    typeof event.hoverDurationMs === 'number' ? event.hoverDurationMs : undefined
  const pageUrl = event.type === 'page' ? toPageUrl(event) : undefined
  const viewDurationMs = typeof event.viewDurationMs === 'number' ? event.viewDurationMs : undefined

  return {
    id,
    componentId,
    firedAt: Date.now(),
    hoverId,
    viewId,
    hoverDurationMs,
    pageUrl,
    type: event.type,
    viewDurationMs,
  }
}

function isViewHeartbeatEvent(event: AnalyticsEvent): boolean {
  return (
    event.type === 'component' &&
    typeof event.viewId === 'string' &&
    typeof event.viewDurationMs === 'number'
  )
}

function isHoverHeartbeatEvent(event: AnalyticsEvent): boolean {
  return (
    event.type === 'component_hover' &&
    typeof event.hoverId === 'string' &&
    typeof event.hoverDurationMs === 'number'
  )
}

function getHeartbeatKey(event: AnalyticsEvent): string | undefined {
  if (isViewHeartbeatEvent(event)) {
    return `component:${event.viewId}`
  }

  if (isHoverHeartbeatEvent(event)) {
    return `component_hover:${event.hoverId}`
  }

  return undefined
}

function upsertAnalyticsEvent(
  previous: AnalyticsEvent[],
  nextEvent: AnalyticsEvent,
): AnalyticsEvent[] {
  const key = getHeartbeatKey(nextEvent)

  if (!key) {
    return [nextEvent, ...previous]
  }

  const existingIndex = previous.findIndex((event) => getHeartbeatKey(event) === key)

  if (existingIndex === -1) {
    return [nextEvent, ...previous]
  }

  const updated = [...previous]
  updated[existingIndex] = {
    ...nextEvent,
    id: previous[existingIndex].id,
    firedAt: previous[existingIndex].firedAt,
  }

  return updated
}

const BADGE_COLORS: Record<string, { background: string; color: string }> = {
  page: { background: '#dbeafe', color: '#1d4ed8' },
  view: { background: '#dcfce7', color: '#15803d' },
  comp: { background: '#d1fae5', color: '#065f46' },
  hover: { background: '#f3e8ff', color: '#7e22ce' },
}
const BADGE_FALLBACK = { background: '#e5e7eb', color: '#374151' }

function toBadgeType(event: AnalyticsEvent): string {
  if (event.type === 'component') return event.viewId ? 'view' : 'comp'
  if (event.type === 'component_hover') return 'hover'
  return event.type
}

function toTestId(event: AnalyticsEvent): string {
  if (event.viewId) return `event-view-${event.viewId}`
  if (event.hoverId) return `event-${event.type}-hover-${event.hoverId}`
  if (event.componentId) return `event-${event.type}-${event.componentId}`
  return `event-${event.type}-${event.id}`
}

function toValue(event: AnalyticsEvent): string {
  return event.componentId ?? event.pageUrl ?? event.type
}

function toDuration(event: AnalyticsEvent): number | undefined {
  return event.hoverDurationMs ?? event.viewDurationMs
}

export function AnalyticsEventDisplay(): JSX.Element {
  const { sdk, isReady } = useOptimization()
  const [events, setEvents] = useState<AnalyticsEvent[]>([])
  const [rawEventsCount, setRawEventsCount] = useState(0)
  const [, tick] = useReducer((n: number) => n + 1, 0)
  const nextId = useRef(0)

  useEffect(() => {
    const id = setInterval(tick, MS_PER_SECOND * TICK_INTERVAL_SECONDS)
    return () => {
      clearInterval(id)
    }
  }, [])

  useEffect(() => {
    if (!isReady || sdk === undefined) {
      setEvents([])
      setRawEventsCount(0)
      nextId.current = 0
      return
    }

    const subscription = sdk.states.eventStream.subscribe((event: unknown) => {
      const id = `event-${nextId.current}`
      const nextEvent = toAnalyticsEvent(event, id)
      if (!nextEvent) {
        return
      }

      nextId.current += 1
      setRawEventsCount((previous) => previous + 1)
      setEvents((previous) => upsertAnalyticsEvent(previous, nextEvent))
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [isReady, sdk])

  return (
    <section data-testid="analytics-events-container">
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
      >
        <h2 style={{ margin: 0 }}>Tracking</h2>
        <span
          style={{
            fontSize: '0.7rem',
            fontWeight: 600,
            background: '#e5e7eb',
            color: '#6b7280',
            padding: '0.15rem 0.5rem',
            borderRadius: 999,
            whiteSpace: 'nowrap',
          }}
        >
          <span data-testid="raw-events-count">{rawEventsCount}</span> events
        </span>
      </div>
      {events.length === 0 ? <p data-testid="no-events-message">No events tracked yet</p> : null}

      {events.length > 0 ? (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.775rem' }}>
          <thead>
            <tr>
              {['Type', 'Value', 'Dur', 'Age', ''].map((h) => (
                <th
                  key={h}
                  style={{
                    fontSize: '0.6rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: '#9ca3af',
                    padding: '0 0.4rem 0.35rem 0',
                    textAlign: 'left',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {events.map((event) => {
              const badgeType = toBadgeType(event)
              const badgeStyle = BADGE_COLORS[badgeType] ?? BADGE_FALLBACK
              const duration = toDuration(event)

              return (
                <tr
                  key={event.id}
                  data-testid={toTestId(event)}
                  data-hover-id={event.hoverId}
                  data-hover-duration-ms={event.hoverDurationMs}
                  data-view-duration-ms={event.viewDurationMs}
                  data-page-url={event.pageUrl}
                  style={{ verticalAlign: 'baseline' }}
                >
                  <td
                    style={{
                      padding: '0.15rem 0.4rem 0.15rem 0',
                      whiteSpace: 'nowrap',
                      fontSize: '0.7rem',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.65rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        padding: '0.1rem 0.35rem',
                        borderRadius: 4,
                        whiteSpace: 'nowrap',
                        ...badgeStyle,
                      }}
                    >
                      {badgeType}
                    </span>
                  </td>
                  <td
                    style={{
                      padding: '0.15rem 0.4rem 0.15rem 0',
                      color: '#6b7280',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: 200,
                    }}
                  >
                    {toValue(event)}
                  </td>
                  <td
                    style={{
                      padding: '0.15rem 0.4rem 0.15rem 0',
                      fontSize: '0.7rem',
                      color: '#6b7280',
                      whiteSpace: 'nowrap',
                      opacity: 0.7,
                    }}
                  >
                    {duration !== undefined ? `${(duration / MS_PER_SECOND).toFixed(1)}s` : null}
                  </td>
                  <td
                    style={{
                      padding: '0.15rem 0.4rem 0.15rem 0',
                      fontSize: '0.65rem',
                      color: '#6b7280',
                      whiteSpace: 'nowrap',
                      opacity: 0.5,
                    }}
                  >
                    {timeAgo(event.firedAt)}
                  </td>
                  <td />
                </tr>
              )
            })}
          </tbody>
        </table>
      ) : null}
    </section>
  )
}
