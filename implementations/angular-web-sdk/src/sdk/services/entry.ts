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
import type { Document } from '@contentful/rich-text-types'
import { INLINES } from '@contentful/rich-text-types'
import type { Entry } from 'contentful'
import { isMergeTagEntry, isRecord } from '../utils'
import { NgContentfulOptimization } from './optimization'

export type ObservationMode = 'auto' | 'manual'

type MergeTagResolver = (target: MergeTagEntry) => string | undefined

export interface EntryMeta {
  baselineId: string
  resolvedId: string
  experienceId: string | undefined
  sticky: boolean | undefined
  variantIndex: number | undefined
  mergeTagResolved: boolean | undefined
}

export interface ResolvedEntryView {
  resolvedEntry: Entry
  meta: EntryMeta
}

function isEntry(value: unknown): value is Entry {
  return isRecord(value) && isRecord(value.sys) && typeof value.sys.id === 'string'
}

function isRichTextDocument(value: unknown): value is Document {
  return isRecord(value) && value.nodeType === 'document' && Array.isArray(value.content)
}

function generateMeta(
  baseline: Entry,
  { entry: resolvedEntry, selectedOptimization }: { entry: Entry; selectedOptimization?: unknown },
): EntryMeta {
  const opt = isRecord(selectedOptimization) ? selectedOptimization : undefined
  const experienceId = typeof opt?.experienceId === 'string' ? opt.experienceId : undefined
  const sticky = typeof opt?.sticky === 'boolean' ? opt.sticky : undefined
  const variantIndex = typeof opt?.variantIndex === 'number' ? opt.variantIndex : undefined
  return {
    baselineId: baseline.sys.id,
    resolvedId: resolvedEntry.sys.id,
    experienceId,
    sticky,
    variantIndex,
    mergeTagResolved: entryHasMergeTag(baseline) ? false : undefined,
  }
}

function hasMergeTagNode(node: unknown): boolean {
  if (!isRecord(node)) return false
  if (node.nodeType === INLINES.EMBEDDED_ENTRY) return true
  if (Array.isArray(node.content)) return node.content.some(hasMergeTagNode)
  return false
}

function entryHasMergeTag(entry: Entry): boolean {
  return Object.values(entry.fields as Record<string, unknown>).some(
    (field) => isRichTextDocument(field) && hasMergeTagNode(field),
  )
}

function resolveRichTextMergeTags(node: Document, resolveMergeTag: MergeTagResolver): Document {
  const resolve = (n: unknown): unknown => {
    if (!isRecord(n)) return n
    if (n.nodeType === INLINES.EMBEDDED_ENTRY) {
      const data = isRecord(n.data) ? n.data : {}
      if (!isMergeTagEntry(data.target)) return n
      return { nodeType: 'text', value: resolveMergeTag(data.target) ?? '', marks: [], data: {} }
    }
    if (!Array.isArray(n.content)) return n
    return { ...n, content: n.content.map(resolve) }
  }
  const content = node.content.map(resolve)
  if (!content.every((n): n is Document['content'][number] => isRecord(n))) return node
  return { ...node, content }
}

function resolveEntryMergeTags(entry: Entry, resolveMergeTag: MergeTagResolver): Entry {
  return Object.assign({}, entry, {
    fields: Object.fromEntries(
      Object.entries(entry.fields as Record<string, unknown>).map(([key, value]) => [
        key,
        isRichTextDocument(value) ? resolveRichTextMergeTags(value, resolveMergeTag) : value,
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

  // Resolves entry variant only — no profile dependency so profile changes don't re-resolve variants.
  // untracked drops selectedOptimizations as a dependency when locked, preventing rerenders.
  private readonly _resolvedVariant: Signal<ResolvedEntryView | undefined> = computed(() => {
    const raw = this._entry()
    if (!isEntry(raw)) return undefined

    const isLive = this._liveUpdates()
    const selectedOptimizations = isLive
      ? this.optimization.selectedOptimizations()
      : untracked(() => this.optimization.selectedOptimizations())

    const resolved = this.optimization.sdk.resolveOptimizedEntry(raw, selectedOptimizations)
    return { resolvedEntry: resolved.entry, meta: generateMeta(raw, resolved) }
  })

  // Applies merge tags on top of the resolved variant. When live, profile() is tracked so merge
  // tags update reactively. When locked, profile is untracked — no rerenders from profile changes.
  readonly resolved: Signal<ResolvedEntryView | undefined> = computed(() => {
    const variant = this._resolvedVariant()
    if (!variant) return undefined

    const isLive = this._liveUpdates()
    const profile = isLive
      ? this.optimization.profile()
      : untracked(() => this.optimization.profile())

    const { resolvedEntry, meta } = variant
    const mergeTagResolved = meta.mergeTagResolved !== undefined ? profile !== undefined : undefined
    return {
      resolvedEntry: resolveEntryMergeTags(resolvedEntry, (target) =>
        profile
          ? this.optimization.sdk.getMergeTagValue(target, profile)
          : target.fields.nt_fallback,
      ),
      meta: { ...meta, mergeTagResolved },
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
        entryId: resolved.meta.resolvedId,
        optimizationId: resolved.meta.experienceId,
        sticky: resolved.meta.sticky,
        variantIndex: resolved.meta.variantIndex,
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
