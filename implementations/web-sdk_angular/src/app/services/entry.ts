import {
  afterNextRender,
  computed,
  effect,
  ElementRef,
  inject,
  Injectable,
  signal,
  untracked,
  type InputSignal,
  type OnDestroy,
  type Signal,
} from '@angular/core'

import type { MergeTagEntry } from '@contentful/optimization-web/api-schemas'
import type { Document, Text } from '@contentful/rich-text-types'
import { INLINES } from '@contentful/rich-text-types'
import type { Entry } from 'contentful'
import { isRecord } from '../utils'
import { NgContentfulOptimization } from './optimization'

export type ObservationMode = 'auto' | 'manual'

type MergeTagResolver = (target: MergeTagEntry) => string | undefined

export interface ResolvedEntryView {
  resolvedEntry: Entry
  baselineId: string
  resolvedId: string
  experienceId: string | undefined
  sticky: boolean | undefined
  variantIndex: number | undefined
  mergeTagResolved: boolean | undefined
}

function isMergeTagEntry(entry: unknown): entry is MergeTagEntry {
  if (!isRecord(entry) || !isRecord(entry.sys)) return false
  if (!isRecord(entry.sys.contentType)) return false
  if (!isRecord(entry.sys.contentType.sys)) return false
  return entry.sys.contentType.sys.id === 'nt_mergetag'
}

function isRichTextDocument(value: unknown): value is Document {
  return isRecord(value) && value.nodeType === 'document' && Array.isArray(value.content)
}

function resolveNode(node: unknown, resolveMergeTag: MergeTagResolver): unknown {
  if (!isRecord(node)) return node
  if (
    node.nodeType === INLINES.EMBEDDED_ENTRY &&
    isRecord(node.data) &&
    isMergeTagEntry(node.data.target)
  ) {
    return {
      nodeType: 'text',
      value: resolveMergeTag(node.data.target) ?? '',
      marks: [],
      data: {},
    } satisfies Text
  }
  if (Array.isArray(node.content)) {
    return { ...node, content: node.content.map((child) => resolveNode(child, resolveMergeTag)) }
  }
  return node
}

function resolveEntryMergeTags(entry: Entry, resolveMergeTag: MergeTagResolver): Entry {
  return Object.assign({}, entry, {
    fields: Object.fromEntries(
      Object.entries(entry.fields).map(([key, value]) => [
        key,
        isRichTextDocument(value) ? resolveNode(value, resolveMergeTag) : value,
      ]),
    ),
  }) as Entry
}

@Injectable()
export class NgContentfulEntry implements OnDestroy {
  private readonly optimization = inject(NgContentfulOptimization)
  private readonly elementRef = inject<ElementRef<Element>>(ElementRef)

  private _entry: Signal<Entry | undefined> = signal(undefined)
  private _liveUpdates: Signal<boolean> = signal(false)
  private _observation: Signal<ObservationMode> | InputSignal<ObservationMode> = signal('auto')
  private readonly _domReady = signal(false)
  private manualTrackingActive = false

  private liveRead<T>(sig: Signal<T>): T {
    return this._liveUpdates() ? sig() : untracked(sig)
  }

  private readonly _variant = computed(() => {
    const raw = this._entry()
    if (!raw) return undefined
    const selectedOptimizations = this.liveRead(this.optimization.selectedOptimizations)
    return {
      raw,
      resolved: this.optimization.sdk.resolveOptimizedEntry(raw, selectedOptimizations),
    }
  })

  readonly resolved: Signal<ResolvedEntryView | undefined> = computed(() => {
    const variant = this._variant()
    if (!variant) return undefined

    const { raw, resolved } = variant
    const profile = this.liveRead(this.optimization.profile)
    let mergeTagResolved: boolean | undefined = undefined
    const resolvedEntry = resolveEntryMergeTags(resolved.entry, (target) => {
      const value = profile ? this.optimization.sdk.getMergeTagValue(target, profile) : undefined
      if (value !== undefined) mergeTagResolved = true
      else mergeTagResolved ??= false
      return value ?? target.fields.nt_fallback
    })

    return {
      resolvedEntry,
      baselineId: raw.sys.id,
      resolvedId: resolved.entry.sys.id,
      experienceId: resolved.selectedOptimization?.experienceId,
      sticky: resolved.selectedOptimization?.sticky,
      variantIndex: resolved.selectedOptimization?.variantIndex,
      mergeTagResolved,
    }
  })

  constructor() {
    afterNextRender(() => {
      this._domReady.set(true)
    })

    effect(() => {
      this.clearManualTracking()

      if (!this._domReady() || this._observation() === 'auto') return

      const resolved = this.resolved()
      if (resolved) this.enableManualTracking(resolved)
    })
  }

  with({
    entry,
    observation,
    liveUpdates,
  }: {
    entry: Signal<Entry>
    observation?: InputSignal<ObservationMode>
    liveUpdates?: Signal<boolean>
  }): this {
    this._entry = entry
    if (observation) this._observation = observation
    if (liveUpdates) this._liveUpdates = liveUpdates
    return this
  }

  private enableManualTracking(resolved: ResolvedEntryView): void {
    this.optimization.sdk.tracking.enableElement('views', this.elementRef.nativeElement, {
      data: {
        entryId: resolved.resolvedId,
        optimizationId: resolved.experienceId,
        sticky: resolved.sticky,
        variantIndex: resolved.variantIndex,
      },
    })
    this.manualTrackingActive = true
  }

  private clearManualTracking(): void {
    if (this.manualTrackingActive) {
      this.optimization.sdk.tracking.clearElement('views', this.elementRef.nativeElement)
      this.manualTrackingActive = false
    }
  }

  ngOnDestroy(): void {
    this.clearManualTracking()
  }
}
