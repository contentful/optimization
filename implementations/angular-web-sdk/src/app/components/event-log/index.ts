import { Component, DestroyRef, computed, inject, signal } from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import { interval } from 'rxjs'
import { NgContentfulOptimization } from '../../services/optimization'
import { isRecord } from '../../utils'

interface AnalyticsEvent {
  id: string
  type: string
  label: string
  testId: string
  count: number
  firedAt: number
  componentId?: string
  viewId?: string
  hoverId?: string
  pageUrl?: string
  userId?: string
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

const TRUNCATE_ID_LENGTH = 5

function eventLabel(event: AnalyticsEvent): string {
  if (event.componentId !== undefined) return `…${event.componentId.slice(-TRUNCATE_ID_LENGTH)}`
  if (event.pageUrl !== undefined) return event.pageUrl
  if (event.userId !== undefined) return event.userId
  return ''
}

function eventTestId(event: AnalyticsEvent): string {
  if (event.viewId !== undefined) return `event-view-${event.viewId}`
  if (event.hoverId !== undefined) return `event-${event.type}-hover-${event.hoverId}`
  if (event.componentId !== undefined) return `event-${event.type}-${event.componentId}`
  return `event-${event.type}-${event.id}`
}

const EVENT_TYPE_LABEL: Record<string, string> = {
  component: 'view',
  component_hover: 'hover',
  component_click: 'click',
  page: 'page',
}

function eventTypeLabel(type: string): string {
  return EVENT_TYPE_LABEL[type] ?? type
}

const MS_PER_SECOND = 1000
const SECONDS_PER_MINUTE = 60
const MINUTES_PER_HOUR = 60
const TICK_INTERVAL_SECONDS = 5

function timeAgo(firedAt: number, now: number): string {
  const s = Math.floor((now - firedAt) / MS_PER_SECOND)
  if (s < SECONDS_PER_MINUTE) return `${s}s ago`
  const m = Math.floor(s / SECONDS_PER_MINUTE)
  if (m < MINUTES_PER_HOUR) return `${m}m ago`
  return `${Math.floor(m / MINUTES_PER_HOUR)}h ago`
}

function dedupeKey(event: AnalyticsEvent): string {
  if (event.componentId !== undefined) return `${event.type}:${event.componentId}`
  if (event.pageUrl !== undefined) return `page:${event.pageUrl}`
  return event.type
}

function toAnalyticsEvent(raw: unknown, id: string): AnalyticsEvent | undefined {
  if (!isRecord(raw) || typeof raw.type !== 'string') return undefined
  const componentId = typeof raw.componentId === 'string' ? raw.componentId : undefined
  const viewId = typeof raw.viewId === 'string' ? raw.viewId : undefined
  const hoverId = typeof raw.hoverId === 'string' ? raw.hoverId : undefined
  const pageUrl = raw.type === 'page' ? toPageUrl(raw) : undefined
  const userId = typeof raw.userId === 'string' ? raw.userId : undefined
  const event: AnalyticsEvent = {
    id,
    type: raw.type,
    label: '',
    testId: '',
    count: 1,
    firedAt: Date.now(),
    componentId,
    viewId,
    hoverId,
    pageUrl,
    userId,
  }
  event.label = eventLabel(event)
  event.testId = eventTestId(event)
  return event
}

function upsert(list: AnalyticsEvent[], next: AnalyticsEvent): AnalyticsEvent[] {
  const key = dedupeKey(next)
  const idx = list.findIndex((e) => dedupeKey(e) === key)
  if (idx === -1) return [next, ...list]
  const updated = [...list]
  const [existing] = updated.splice(idx, 1)
  return [
    { ...next, id: existing.id, count: existing.count + 1, firedAt: next.firedAt },
    ...updated,
  ]
}

@Component({
  selector: 'app-event-log',
  templateUrl: './index.html',
})
export class EventLog {
  private readonly optimization = inject(NgContentfulOptimization)
  private nextId = 0

  protected readonly eventTypeLabel = eventTypeLabel
  protected readonly timeAgo = timeAgo
  private readonly events = signal<AnalyticsEvent[]>([])
  private readonly tick = toSignal(interval(TICK_INTERVAL_SECONDS * MS_PER_SECOND), {
    initialValue: 0,
  })
  protected readonly displayEvents = computed(() => {
    this.tick()
    const now = Date.now()
    return this.events().map((e) => ({ ...e, timeAgo: timeAgo(e.firedAt, now) }))
  })

  constructor() {
    const sub = this.optimization.sdk.states.eventStream.subscribe((raw) => {
      const event = toAnalyticsEvent(raw, `event-${this.nextId}`)
      if (!event) return
      this.nextId++
      this.events.update((list) => upsert(list, event))
    })
    inject(DestroyRef).onDestroy(() => {
      sub.unsubscribe()
    })
  }
}
