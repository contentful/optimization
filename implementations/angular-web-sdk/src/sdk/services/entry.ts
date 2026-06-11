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
import type { SelectedOptimizationArray } from '@contentful/optimization-web/api-schemas'
import type { Document } from '@contentful/rich-text-types'
import { INLINES } from '@contentful/rich-text-types'
import type { Entry } from 'contentful'
import { isMergeTagEntry, isRecord } from '../utils'
import { NgContentfulOptimization } from './optimization'

export type ObservationMode = 'auto' | 'manual'

export interface EntryMeta {
  experienceId: string | undefined
  sticky: boolean | undefined
  variantIndex: number | undefined
  mergeTagResolved: boolean | undefined
}

export interface ResolvedEntryView {
  resolvedEntry: Entry
  baselineId: string
  resolvedId: string
  meta: EntryMeta
}

function isEntry(value: unknown): value is Entry {
  return isRecord(value) && isRecord(value.sys) && typeof value.sys.id === 'string'
}

function isRichTextDocument(value: unknown): value is Document {
  return isRecord(value) && value.nodeType === 'document' && Array.isArray(value.content)
}

function mapToResolvedEntryView(
  baseline: Entry,
  { entry: resolvedEntry, selectedOptimization }: { entry: Entry; selectedOptimization?: unknown },
): ResolvedEntryView {
  const opt = isRecord(selectedOptimization) ? selectedOptimization : undefined
  const experienceId = typeof opt?.experienceId === 'string' ? opt.experienceId : undefined
  return {
    resolvedEntry,
    baselineId: baseline.sys.id,
    resolvedId: resolvedEntry.sys.id,
    meta: {
      experienceId,
      sticky: typeof opt?.sticky === 'boolean' ? opt.sticky : undefined,
      variantIndex: typeof opt?.variantIndex === 'number' ? opt.variantIndex : undefined,
      mergeTagResolved: entryHasMergeTag(baseline) ? false : undefined,
    },
  }
}

function toStringValue(value: unknown): string {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean')
    return `${value}`
  if (typeof value === 'symbol') return value.description ?? value.toString()
  return JSON.stringify(value)
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

function resolveRichTextMergeTags(
  node: Document,
  resolveMergeTag: (target: unknown) => string,
): Document {
  const resolve = (n: unknown): unknown => {
    if (!isRecord(n)) return n
    if (n.nodeType === INLINES.EMBEDDED_ENTRY) {
      const data = isRecord(n.data) ? n.data : {}
      return { nodeType: 'text', value: resolveMergeTag(data.target), marks: [], data: {} }
    }
    if (!Array.isArray(n.content)) return n
    return { ...n, content: n.content.map(resolve) }
  }
  const content = node.content.map(resolve)
  if (!content.every((n): n is Document['content'][number] => isRecord(n))) return node
  return { ...node, content }
}

function resolveEntryFields(
  fields: Record<string, unknown>,
  resolveMergeTag: (target: unknown) => string,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [
      key,
      isRichTextDocument(value) ? resolveRichTextMergeTags(value, resolveMergeTag) : value,
    ]),
  )
}

function resolveEntryMergeTags(entry: Entry, resolveMergeTag: (target: unknown) => string): Entry {
  return Object.assign({}, entry, {
    fields: resolveEntryFields(entry.fields as Record<string, unknown>, resolveMergeTag),
  }) as Entry
}

@Injectable()
export class NgContentfulEntry implements OnDestroy {
  private readonly optimization = inject(NgContentfulOptimization)
  private readonly elementRef = inject<ElementRef<Element>>(ElementRef)

  private _entry: Signal<Entry | undefined> = signal(undefined)
  private _selectedOptimizations: Signal<SelectedOptimizationArray | undefined> = signal(undefined)
  private _liveUpdates: Signal<boolean> = signal(false)
  private _observation: Signal<ObservationMode> = signal('auto')
  private readonly _domReady = signal(false)
  private manualTrackingActive = false

  // Resolves entry variant only — no profile dependency so profile changes don't re-resolve variants.
  // untracked drops selectedOptimizations as a dependency when locked, preventing rerenders.
  private readonly _resolvedVariant: Signal<ResolvedEntryView | undefined> = computed(() => {
    const raw = this._entry()
    if (!isEntry(raw)) return undefined

    const isLive = this._liveUpdates()
    const selectedOptimizations = isLive
      ? (this._selectedOptimizations() ?? this.optimization.selectedOptimizations())
      : untracked(() => this._selectedOptimizations() ?? this.optimization.selectedOptimizations())

    return mapToResolvedEntryView(
      raw,
      this.optimization.sdk.resolveOptimizedEntry(raw, selectedOptimizations),
    )
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
    const resolveMergeTag = (target: unknown): string => {
      if (!isMergeTagEntry(target)) return ''
      if (!profile) return toStringValue(target.fields.nt_fallback)
      return toStringValue(this.optimization.sdk.getMergeTagValue(target, profile))
    }

    return {
      ...variant,
      resolvedEntry: resolveEntryMergeTags(variant.resolvedEntry, resolveMergeTag),
      meta: {
        ...variant.meta,
        mergeTagResolved:
          variant.meta.mergeTagResolved !== undefined ? profile !== undefined : undefined,
      },
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
      if (!resolved) return

      this.optimization.sdk.tracking.enableElement('views', this.elementRef.nativeElement, {
        data: {
          entryId: resolved.resolvedId,
          optimizationId: resolved.meta.experienceId,
          sticky: resolved.meta.sticky,
          variantIndex: resolved.meta.variantIndex,
        },
      })
      this.manualTrackingActive = true
    })
  }

  with({
    entry,
    observation,
    selectedOptimizations,
    liveUpdates,
  }: {
    entry: Signal<Entry>
    observation?: InputSignal<ObservationMode>
    selectedOptimizations?: InputSignal<SelectedOptimizationArray | undefined>
    liveUpdates?: Signal<boolean>
  }): this {
    this._entry = entry
    if (observation) this._observation = observation
    if (selectedOptimizations) this._selectedOptimizations = selectedOptimizations
    if (liveUpdates) this._liveUpdates = liveUpdates
    return this
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
