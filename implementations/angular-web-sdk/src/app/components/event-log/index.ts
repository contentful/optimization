import { Component, DestroyRef, computed, inject, signal } from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import { interval } from 'rxjs'
import { NgContentfulOptimization } from '../../services/optimization'

type EventType = 'component' | 'component_hover' | 'component_click' | 'page'

interface AnalyticsEvent {
  type: EventType
  label: string
  testId: string
  key: string
  count: number
  firedAt: number
}

const EVENT_TYPE_LABEL: Record<EventType, string> = {
  component: 'view',
  component_hover: 'hover',
  component_click: 'click',
  page: 'page',
}

function eventTypeLabel(type: EventType): string {
  return EVENT_TYPE_LABEL[type]
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

function toPageUrl(url: string): string {
  try {
    return new URL(url, window.location.origin).pathname
  } catch {
    return url
  }
}

function upsert(list: AnalyticsEvent[], next: AnalyticsEvent): AnalyticsEvent[] {
  const idx = list.findIndex((e) => e.key === next.key)
  if (idx === -1) return [next, ...list]
  const updated = [...list]
  const [existing] = updated.splice(idx, 1)
  return [{ ...next, count: existing.count + 1, firedAt: next.firedAt }, ...updated]
}

@Component({
  selector: 'app-event-log',
  templateUrl: './index.html',
})
export class EventLog {
  private readonly optimization = inject(NgContentfulOptimization)

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

  private track(event: Omit<AnalyticsEvent, 'count' | 'firedAt' | 'testId'>): void {
    const testId = `event-${event.key}`
    this.events.update((list) => upsert(list, { ...event, testId, count: 1, firedAt: Date.now() }))
  }

  constructor() {
    const sub = this.optimization.sdk.states.eventStream.subscribe((raw) => {
      if (!raw) return
      switch (raw.type) {
        case 'page': {
          const pageUrl = toPageUrl(raw.properties.url)
          this.track({ type: 'page', label: pageUrl, key: `page-${pageUrl}` })
          break
        }
        case 'component':
        case 'component_hover':
        case 'component_click': {
          const { type, componentId } = raw
          this.track({ type, label: componentId, key: `${type}-${componentId}` })
          break
        }
        default:
          break
      }
    })
    inject(DestroyRef).onDestroy(() => {
      sub.unsubscribe()
    })
  }
}
