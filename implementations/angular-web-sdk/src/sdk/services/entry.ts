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
import type { Entry } from 'contentful'
import { isMergeTagEntry, isRecord } from '../utils'
import { NgContentfulOptimization } from './optimization'

export type ObservationMode = 'auto' | 'manual'

export interface EntryMeta {
  experienceId: string | undefined
  sticky: boolean | undefined
  variantIndex: number | undefined
}

export interface ResolvedEntryView {
  resolvedEntry: Entry
  baselineId: string
  resolvedId: string
  meta: EntryMeta
  isVariant: boolean
}

function extractMeta(value: unknown): EntryMeta {
  if (!isRecord(value))
    return { experienceId: undefined, sticky: undefined, variantIndex: undefined }
  return {
    experienceId: typeof value.experienceId === 'string' ? value.experienceId : undefined,
    sticky: typeof value.sticky === 'boolean' ? value.sticky : undefined,
    variantIndex: typeof value.variantIndex === 'number' ? value.variantIndex : undefined,
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

  readonly resolved: Signal<ResolvedEntryView | undefined> = computed(() => {
    const entry = this._entry()
    if (entry === undefined) return undefined
    if (this._liveUpdates()) {
      return this.resolveEntry(entry, this._selectedOptimizations())
    }

    // untracked drops selectedOptimizations as a dependency, preventing rerenders when locked.
    return untracked(() => this.resolveEntry(entry, this._selectedOptimizations()))
  })

  constructor() {
    afterNextRender(() => {
      this._domReady.set(true)
    })

    effect(() => {
      this.clearManualTracking()

      if (!this._domReady() || this._observation() === 'auto') return

      const resolved = this.resolved()
      if (resolved === undefined) return

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
    entry: InputSignal<Entry>
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

  resolveMergeTag(target: unknown): string {
    if (!isMergeTagEntry(target)) return '[Merge Tag]'
    return toStringValue(this.optimization.sdk.getMergeTagValue(target))
  }

  private resolveEntry(
    baseline: Entry,
    selectedOptimizations?: SelectedOptimizationArray,
  ): ResolvedEntryView {
    const resolved = this.optimization.sdk.resolveOptimizedEntry(
      baseline,
      selectedOptimizations ?? this.optimization.selectedOptimizations(),
    )
    const { entry: resolvedEntry } = resolved
    const meta = extractMeta(resolved.selectedOptimization)
    return {
      resolvedEntry,
      baselineId: baseline.sys.id,
      resolvedId: resolvedEntry.sys.id,
      meta,
      isVariant: meta.experienceId !== undefined,
    }
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
