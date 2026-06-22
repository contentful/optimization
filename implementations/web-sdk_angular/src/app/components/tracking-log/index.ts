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
  hoverDurationMs?: number
  viewDurationMs?: number
  hoverId?: string
}

const MS_PER_SECOND = 1000
const SECONDS_PER_MINUTE = 60
const MINUTES_PER_HOUR = 60
const TICK_INTERVAL_SECONDS = 5

function timeAgo(firedAt: number, now: number): string {
  const s = Math.floor((now - firedAt) / MS_PER_SECOND)
  if (s < SECONDS_PER_MINUTE) return `${s}s`
  const m = Math.floor(s / SECONDS_PER_MINUTE)
  if (m < MINUTES_PER_HOUR) return `${m}m`
  return `${Math.floor(m / MINUTES_PER_HOUR)}h`
}

@Component({
  selector: 'app-tracking-log',
  templateUrl: './index.html',
})
export class TrackingLog {
  private readonly optimization = inject(NgContentfulOptimization)

  private readonly events = signal<Map<string, AnalyticsEvent>>(new Map())
  private readonly rawEventsCount = signal(0)
  private readonly tick = toSignal(interval(TICK_INTERVAL_SECONDS * MS_PER_SECOND), {
    initialValue: 0,
  })
  protected readonly rawEventsDisplay = this.rawEventsCount.asReadonly()
  protected readonly displayEvents = computed(() => {
    this.tick()
    const now = Date.now()
    return [...this.events().values()]
      .sort((a, b) => b.firedAt - a.firedAt)
      .map((e) => ({ ...e, time: timeAgo(e.firedAt, now) }))
  })

  constructor() {
    let pageSeq = 0
    let componentSeq = 0
    const sub = this.optimization.sdk.states.eventStream.subscribe((raw) => {
      if (raw != null) {
        this.rawEventsCount.update((n) => n + 1)
      }
      switch (raw?.type) {
        case 'page': {
          const {
            properties: { url },
          } = raw
          pageSeq += 1
          const pathname = (() => {
            try {
              return new URL(url, window.location.origin).pathname
            } catch {
              return url
            }
          })()
          this.track({ type: 'page', value: pathname, key: `page-${pageSeq}-${url}` })
          break
        }
        case 'component': {
          const { componentId, viewId, viewDurationMs } = raw
          if (viewId) {
            this.track({
              type: 'view',
              value: componentId,
              key: `view-${viewId}`,
              viewDurationMs: typeof viewDurationMs === 'number' ? viewDurationMs : undefined,
            })
          } else {
            componentSeq += 1
            this.track(
              { type: 'comp', value: componentId, key: `component-${componentId}-${componentSeq}` },
              `event-component-${componentId}`,
            )
          }
          break
        }
        case 'component_hover': {
          const { componentId, hoverId, hoverDurationMs } = raw
          if (hoverId) {
            this.track({
              type: 'hover',
              value: componentId,
              key: `component_hover-hover-${hoverId}`,
              hoverDurationMs: typeof hoverDurationMs === 'number' ? hoverDurationMs : undefined,
              hoverId,
            })
          } else {
            this.track({ type: 'hover', value: componentId, key: `component_hover-${componentId}` })
          }
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

  private track(
    event: Omit<AnalyticsEvent, 'count' | 'firedAt' | 'testId'>,
    testId?: string,
  ): void {
    const { key } = event
    this.events.update((map) => {
      const existing = map.get(key)
      return new Map(map).set(key, {
        ...event,
        testId: testId ?? `event-${key}`,
        count: (existing?.count ?? 0) + 1,
        firedAt: Date.now(),
      })
    })
  }
}
