import { Component, inject, type OnDestroy, type OnInit, signal } from '@angular/core'
import type { Subscription } from 'rxjs'
import { Optimization } from '../../optimization/optimization'
import { isRecord } from '../../utils/type-guards'

interface AnalyticsEvent {
  id: string
  type: string
  componentId?: string
  viewId?: string
  hoverId?: string
  viewDurationMs?: number
  hoverDurationMs?: number
  pageUrl?: string
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

function toAnalyticsEvent(raw: unknown, id: string): AnalyticsEvent | undefined {
  if (!isRecord(raw) || typeof raw.type !== 'string') return undefined
  return {
    id,
    type: raw.type,
    componentId: typeof raw.componentId === 'string' ? raw.componentId : undefined,
    viewId: typeof raw.viewId === 'string' ? raw.viewId : undefined,
    hoverId: typeof raw.hoverId === 'string' ? raw.hoverId : undefined,
    viewDurationMs: typeof raw.viewDurationMs === 'number' ? raw.viewDurationMs : undefined,
    hoverDurationMs: typeof raw.hoverDurationMs === 'number' ? raw.hoverDurationMs : undefined,
    pageUrl: raw.type === 'page' ? toPageUrl(raw) : undefined,
  }
}

function heartbeatKey(event: AnalyticsEvent): string | undefined {
  if (event.type === 'component' && event.viewId !== undefined) return `component:${event.viewId}`
  if (event.type === 'component_hover' && event.hoverId !== undefined)
    return `component_hover:${event.hoverId}`
  return undefined
}

function upsert(list: AnalyticsEvent[], next: AnalyticsEvent): AnalyticsEvent[] {
  const key = heartbeatKey(next)
  if (!key) return [next, ...list]
  const idx = list.findIndex((e) => heartbeatKey(e) === key)
  if (idx === -1) return [next, ...list]
  const updated = [...list]
  updated[idx] = { ...next, id: list[idx].id }
  return updated
}

function eventLabel(event: AnalyticsEvent): string {
  if (event.componentId !== undefined) {
    if (event.viewDurationMs !== undefined)
      return `${event.componentId} — ${event.viewDurationMs}ms`
    if (event.hoverDurationMs !== undefined)
      return `${event.componentId} — ${event.hoverDurationMs}ms`
    return event.componentId
  }
  if (event.pageUrl !== undefined) return event.pageUrl
  return ''
}

function eventTestId(event: AnalyticsEvent): string {
  if (event.viewId !== undefined) return `event-view-${event.viewId}`
  if (event.hoverId !== undefined) return `event-${event.type}-hover-${event.hoverId}`
  if (event.componentId !== undefined) return `event-${event.type}-${event.componentId}`
  return `event-${event.type}-${event.id}`
}

@Component({
  selector: 'app-analytics-event-display',
  templateUrl: './analytics-event-display.html',
})
export class AnalyticsEventDisplay implements OnInit, OnDestroy {
  private readonly optimization = inject(Optimization)
  private subscription: Subscription | undefined
  private nextId = 0

  protected readonly events = signal<AnalyticsEvent[]>([])
  protected readonly rawCount = signal(0)

  protected readonly eventLabel = eventLabel
  protected readonly eventTestId = eventTestId

  ngOnInit(): void {
    this.subscription = this.optimization.eventStream$.subscribe((raw) => {
      const event = toAnalyticsEvent(raw, `event-${this.nextId}`)
      if (!event) return
      this.nextId++
      this.rawCount.update((c) => c + 1)
      this.events.update((list) => upsert(list, event))
    })
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe()
  }
}
