import { Component, DestroyRef, computed, inject, signal } from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import { interval } from 'rxjs'
import { NgContentfulOptimization } from '../../services/optimization'

interface AnalyticsEvent {
  type: string
  value: string
  testId: string
  key: string
  count: number
  firedAt: number
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
  selector: 'app-tracking',
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export class Tracking {
  private readonly optimization = inject(NgContentfulOptimization)

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
    const { key } = event
    this.events.update((map) => {
      const existing = map.get(key)
      return new Map(map).set(key, {
        ...event,
        testId: `event-${key}`,
        count: (existing?.count ?? 0) + 1,
        firedAt: Date.now(),
      })
    })
  }

  constructor() {
    const sub = this.optimization.sdk.states.eventStream.subscribe((raw) => {
      switch (raw?.type) {
        case 'page': {
          const {
            properties: { url },
          } = raw
          this.track({ type: 'page', value: url, key: `page-${url}` })
          break
        }
        case 'component': {
          const { componentId, viewId } = raw
          this.track({
            type: viewId ? 'view' : 'comp',
            value: componentId,
            key: `component-${componentId}`,
          })
          break
        }
        case 'component_hover': {
          const { componentId } = raw
          this.track({ type: 'hover', value: componentId, key: `component_hover-${componentId}` })
          break
        }
        case 'component_click': {
          const { componentId } = raw
          this.track({ type: 'click', value: componentId, key: `component_click-${componentId}` })
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
