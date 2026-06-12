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

@Component({
  selector: 'app-event-log',
  templateUrl: './index.html',
})
export class EventLog {
  private readonly optimization = inject(NgContentfulOptimization)

  protected readonly eventTypeLabel = eventTypeLabel
  private readonly events = signal<Map<string, AnalyticsEvent>>(new Map())
  private readonly tick = toSignal(interval(TICK_INTERVAL_SECONDS * MS_PER_SECOND), {
    initialValue: 0,
  })
  protected readonly displayEvents = computed(() => {
    this.tick()
    const now = Date.now()
    return [...this.events().values()]
      .sort((a, b) => b.firedAt - a.firedAt)
      .map((e) => ({ ...e, timeAgo: timeAgo(e.firedAt, now) }))
  })

  private track(event: Omit<AnalyticsEvent, 'count' | 'firedAt' | 'testId'>): void {
    const testId = `event-${event.key}`
    this.events.update((map) => {
      const existing = map.get(event.key)
      return new Map(map).set(event.key, {
        ...event,
        testId,
        count: (existing?.count ?? 0) + 1,
        firedAt: Date.now(),
      })
    })
  }

  constructor() {
    const sub = this.optimization.sdk.states.eventStream.subscribe((raw) => {
      if (!raw) return
      switch (raw.type) {
        case 'page': {
          const {
            properties: { url },
          } = raw
          this.track({ type: 'page', label: url, key: `page-${url}` })
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
