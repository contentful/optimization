'use client'

import { useEventStream, useTick } from '@/lib/hooks'
import { isRecord } from '@contentful/optimization-nextjs/api-schemas'
import { type JSX } from 'react'

const MS_PER_SECOND = 1000
const SECONDS_PER_MINUTE = 60
const MINUTES_PER_HOUR = 60

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
  count: number
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
  if (!isRecord(properties)) return undefined
  const { url } = properties
  if (typeof url !== 'string' || url.length === 0) return undefined
  try {
    return new URL(url, window.location.origin).pathname
  } catch {
    return url
  }
}

function toAnalyticsEvent(event: unknown, id: string): AnalyticsEvent | undefined {
  if (!isRecord(event) || typeof event.type !== 'string') return undefined

  return {
    id,
    componentId: typeof event.componentId === 'string' ? event.componentId : undefined,
    count: 1,
    firedAt: Date.now(),
    hoverId: typeof event.hoverId === 'string' ? event.hoverId : undefined,
    viewId: typeof event.viewId === 'string' ? event.viewId : undefined,
    hoverDurationMs: typeof event.hoverDurationMs === 'number' ? event.hoverDurationMs : undefined,
    pageUrl: event.type === 'page' ? toPageUrl(event) : undefined,
    type: event.type,
    viewDurationMs: typeof event.viewDurationMs === 'number' ? event.viewDurationMs : undefined,
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
  if (isViewHeartbeatEvent(event)) return `component:${event.viewId}`
  if (isHoverHeartbeatEvent(event)) return `component_hover:${event.hoverId}`
  return undefined
}

function upsertAnalyticsEvent(previous: AnalyticsEvent[], next: AnalyticsEvent): AnalyticsEvent[] {
  const key = getHeartbeatKey(next)
  if (!key) return [next, ...previous]
  const existingIndex = previous.findIndex((e) => getHeartbeatKey(e) === key)
  if (existingIndex === -1) return [next, ...previous]
  const updated = [...previous]
  updated[existingIndex] = {
    ...next,
    id: previous[existingIndex].id,
    count: previous[existingIndex].count + 1,
    firedAt: previous[existingIndex].firedAt,
  }
  return updated
}

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

export function TrackingLog(): JSX.Element {
  useTick()
  const { events, rawCount } = useEventStream(toAnalyticsEvent, upsertAnalyticsEvent)

  return (
    <section className="tracking-log" data-testid="analytics-events-container">
      <div className="tracking-log__header">
        <h2>Tracking</h2>
        <span className="tracking-log__badge">
          <span data-testid="raw-events-count">{rawCount}</span> events
        </span>
      </div>
      <p data-testid="events-count" style={{ display: 'none' }}>
        {events.length}
      </p>
      {events.length === 0 ? (
        <p className="tracking-log__empty" data-testid="no-events-message">
          No events tracked yet
        </p>
      ) : null}

      {events.length > 0 ? (
        <table className="tracking-log__table">
          <thead className="tracking-log__thead">
            <tr>
              {['Type', 'Value', 'Dur', 'Age', ''].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {events.map((event) => {
              const badgeType = toBadgeType(event)
              const duration = toDuration(event)

              return (
                <tr
                  key={event.id}
                  data-hover-duration-ms={event.hoverDurationMs}
                  data-hover-id={event.hoverId}
                  data-page-url={event.pageUrl}
                  data-testid={toTestId(event)}
                >
                  <td>
                    <span className={`tracking-log__type tracking-log__type--${badgeType}`}>
                      {badgeType}
                    </span>
                  </td>
                  <td className="tracking-log__label">{toValue(event)}</td>
                  <td className="tracking-log__duration">
                    {duration !== undefined ? `${(duration / MS_PER_SECOND).toFixed(1)}s` : null}
                  </td>
                  <td className="tracking-log__time">{timeAgo(event.firedAt)}</td>
                  <td className="tracking-log__count">
                    {event.count > 1 ? `×${event.count}` : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      ) : null}
    </section>
  )
}
