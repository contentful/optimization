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
  isVariant: boolean
}

export interface ResolvedEntryView {
  resolvedEntry: Entry
  baselineId: string
  resolvedId: string
  meta: EntryMeta
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
      isVariant: experienceId !== undefined,
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

    // untracked drops selectedOptimizations as a dependency, preventing rerenders when locked.
    const selectedOptimizations = this._liveUpdates()
      ? this._selectedOptimizations()
      : untracked(() => this._selectedOptimizations())

    return mapToResolvedEntryView(
      entry,
      this.optimization.sdk.resolveOptimizedEntry(
        entry,
        selectedOptimizations ?? this.optimization.selectedOptimizations(),
      ),
    )
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
