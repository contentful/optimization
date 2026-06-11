import { Component, computed, DestroyRef, inject, signal } from '@angular/core'
import { NgContentfulOptimization } from '../../services/optimization'
import { isRecord } from '../../utils'

interface AnalyticsEvent {
  id: string
  type: string
  label: string
  testId: string
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

function eventLabel(event: AnalyticsEvent): string {
  if (event.componentId !== undefined) {
    const base = `id: ${event.componentId}`
    if (event.viewDurationMs !== undefined && event.viewDurationMs > 0)
      return `${base} — ${event.viewDurationMs}ms`
    if (event.hoverDurationMs !== undefined && event.hoverDurationMs > 0)
      return `${base} — ${event.hoverDurationMs}ms`
    return base
  }
  if (event.pageUrl !== undefined) return `url: ${event.pageUrl}`
  return ''
}

function eventTestId(event: AnalyticsEvent): string {
  if (event.viewId !== undefined) return `event-view-${event.viewId}`
  if (event.hoverId !== undefined) return `event-${event.type}-hover-${event.hoverId}`
  if (event.componentId !== undefined) return `event-${event.type}-${event.componentId}`
  return `event-${event.type}-${event.id}`
}

function toAnalyticsEvent(raw: unknown, id: string): AnalyticsEvent | undefined {
  if (!isRecord(raw) || typeof raw.type !== 'string') return undefined
  const componentId = typeof raw.componentId === 'string' ? raw.componentId : undefined
  const viewId = typeof raw.viewId === 'string' ? raw.viewId : undefined
  const hoverId = typeof raw.hoverId === 'string' ? raw.hoverId : undefined
  const viewDurationMs = typeof raw.viewDurationMs === 'number' ? raw.viewDurationMs : undefined
  const hoverDurationMs = typeof raw.hoverDurationMs === 'number' ? raw.hoverDurationMs : undefined
  const pageUrl = raw.type === 'page' ? toPageUrl(raw) : undefined
  const event: AnalyticsEvent = {
    id,
    type: raw.type,
    label: '',
    testId: '',
    componentId,
    viewId,
    hoverId,
    viewDurationMs,
    hoverDurationMs,
    pageUrl,
  }
  event.label = eventLabel(event)
  event.testId = eventTestId(event)
  return event
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

@Component({
  selector: 'app-event-log',
  templateUrl: './index.html',
})
export class EventLog {
  private readonly optimization = inject(NgContentfulOptimization)
  private nextId = 0

  protected readonly uniqueEvents = signal<AnalyticsEvent[]>([])
  protected readonly rawEvents = signal<AnalyticsEvent[]>([])
  protected readonly mode = signal<'unique' | 'raw'>('unique')
  protected readonly visibleEvents = computed(() =>
    this.mode() === 'unique' ? this.uniqueEvents() : this.rawEvents(),
  )

  constructor() {
    const sub = this.optimization.sdk.states.eventStream.subscribe((raw) => {
      const event = toAnalyticsEvent(raw, `event-${this.nextId}`)
      if (!event) return
      this.nextId++
      this.rawEvents.update((list) => [event, ...list])
      this.uniqueEvents.update((list) => upsert(list, event))
    })
    inject(DestroyRef).onDestroy(() => {
      sub.unsubscribe()
    })
  }
}
