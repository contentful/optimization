import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import type { OptimizationEventStreamEvent } from '@contentful/optimization-web/core-sdk'
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

type StreamEvent = OptimizationEventStreamEvent
type EventOfType<T extends StreamEvent['type']> = Extract<StreamEvent, { type: T }>

@Component({
  selector: 'app-tracking-log',
  templateUrl: './index.html',
})
export class TrackingLog {
  private readonly optimization = inject(NgContentfulOptimization)
  private readonly destroyRef = inject(DestroyRef)

  private readonly events = signal<Map<string, AnalyticsEvent>>(new Map())
  private readonly rawEventsCount = signal(0)
  private readonly tick = toSignal(interval(TICK_INTERVAL_SECONDS * MS_PER_SECOND), {
    initialValue: 0,
  })

  // Per-event-type sequence counters. Externalized from the dispatch so each
  // handler stays a straight input→track mapping without threading closure
  // state through the switch.
  private pageSeq = 0
  private componentSeq = 0

  protected readonly rawEventsDisplay = this.rawEventsCount.asReadonly()
  protected readonly displayEvents = computed(() => {
    this.tick()
    const now = Date.now()
    return [...this.events().values()]
      .sort((a, b) => b.firedAt - a.firedAt)
      .map((e) => ({ ...e, time: timeAgo(e.firedAt, now) }))
  })

  constructor() {
    let sub: { unsubscribe: () => void } | undefined = undefined

    // Re-subscribe when the runtime swaps from the SSR snapshot runtime to
    // the live SDK. The snapshot runtime's static eventStream never emits, so
    // the initial subscription is a harmless no-op that is torn down on swap.
    effect(() => {
      const runtime = this.optimization.runtime()
      sub?.unsubscribe()
      sub = runtime.states.eventStream.subscribe((raw) => {
        this.dispatch(raw)
      })
    })

    this.destroyRef.onDestroy(() => {
      sub?.unsubscribe()
    })
  }

  private dispatch(raw: StreamEvent | undefined): void {
    if (raw == null) return
    this.rawEventsCount.update((n) => n + 1)

    switch (raw.type) {
      case 'page':
        this.handlePage(raw)
        break
      case 'component':
        this.handleComponent(raw)
        break
      case 'component_hover':
        this.handleHover(raw)
        break
      case 'component_click':
        this.handleClick(raw)
        break
      default:
        break
    }
  }

  private handlePage(raw: EventOfType<'page'>): void {
    const {
      properties: { url },
    } = raw
    this.pageSeq += 1
    const pathname = (() => {
      try {
        return new URL(url, window.location.origin).pathname
      } catch {
        return url
      }
    })()
    this.track({ type: 'page', value: pathname, key: `page-${this.pageSeq}-${url}` })
  }

  private handleComponent(raw: EventOfType<'component'>): void {
    const { componentId, viewId, viewDurationMs } = raw
    if (viewId) {
      this.track({
        type: 'view',
        value: componentId,
        key: `view-${viewId}`,
        viewDurationMs: typeof viewDurationMs === 'number' ? viewDurationMs : undefined,
      })
      return
    }
    this.componentSeq += 1
    this.track(
      { type: 'comp', value: componentId, key: `component-${componentId}-${this.componentSeq}` },
      `event-component-${componentId}`,
    )
  }

  private handleHover(raw: EventOfType<'component_hover'>): void {
    const { componentId, hoverId, hoverDurationMs } = raw
    if (hoverId) {
      this.track({
        type: 'hover',
        value: componentId,
        key: `component_hover-hover-${hoverId}`,
        hoverDurationMs: typeof hoverDurationMs === 'number' ? hoverDurationMs : undefined,
        hoverId,
      })
      return
    }
    this.track({ type: 'hover', value: componentId, key: `component_hover-${componentId}` })
  }

  private handleClick(raw: EventOfType<'component_click'>): void {
    const { componentId } = raw
    this.track({ type: 'click', value: componentId, key: `component_click-${componentId}` })
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
