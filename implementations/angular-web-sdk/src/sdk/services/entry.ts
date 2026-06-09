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
import { NgContentfulLiveUpdates } from './live-updates'
import { NgContentfulOptimization } from './optimization'
import { NgContentfulOptimizationResolver, type ResolvedEntryView } from './optimization-resolver'

export type ObservationMode = 'auto' | 'manual'

@Injectable()
export class NgContentfulEntry implements OnDestroy {
  private readonly resolver = inject(NgContentfulOptimizationResolver)
  private readonly liveUpdates = inject(NgContentfulLiveUpdates)
  private readonly optimization = inject(NgContentfulOptimization)
  private readonly elementRef = inject<ElementRef<Element>>(ElementRef)

  private readonly _entry = signal<Entry | undefined>(undefined)
  private readonly _selectedOptimizations = signal<SelectedOptimizationArray | undefined>(undefined)
  private readonly _liveUpdatesOverride = signal<boolean | undefined>(undefined)
  private readonly _lockedSnapshot = signal<ResolvedEntryView | undefined>(undefined)
  private readonly _observation = signal<ObservationMode>('auto')
  private readonly _domReady = signal(false)
  private manualTrackingActive = false

  readonly isLive = computed(() => {
    if (this.liveUpdates.previewPanelVisible()) return true
    const override = this._liveUpdatesOverride()
    if (override !== undefined) return override
    return this.liveUpdates.globalLiveUpdates()
  })

  readonly resolved: Signal<ResolvedEntryView | undefined> = computed(() => {
    const entry = this._entry()
    if (entry === undefined) return undefined
    const locked = this._lockedSnapshot()
    if (locked !== undefined) return locked
    return this.resolver.resolveWithMeta(entry, this._selectedOptimizations())
  })

  constructor() {
    effect(() => {
      const live = this.isLive()
      if (live) {
        untracked(() => {
          this.clearSnapshot()
        })
      } else {
        untracked(() => {
          this.lockSnapshot()
        })
      }
    })

    afterNextRender(() => {
      this._domReady.set(true)
    })

    effect(() => {
      const ready = this._domReady()
      const mode = this._observation()
      if (!ready || mode !== 'manual' || this.optimization.sdk === undefined) return

      const resolved = this.resolved()
      if (resolved === undefined) return

      if (this.manualTrackingActive) {
        this.optimization.sdk.tracking.clearElement('views', this.elementRef.nativeElement)
        this.manualTrackingActive = false
      }

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

  with(config: {
    entry: InputSignal<Entry>
    observation?: InputSignal<ObservationMode>
    selectedOptimizations?: InputSignal<SelectedOptimizationArray | undefined>
    liveUpdates?: InputSignal<boolean | undefined>
  }): this {
    effect(() => {
      this._entry.set(config.entry())
      if (config.observation) this._observation.set(config.observation())
      if (config.selectedOptimizations)
        this._selectedOptimizations.set(config.selectedOptimizations())
      if (config.liveUpdates) this._liveUpdatesOverride.set(config.liveUpdates())
    })
    return this
  }

  resolveMergeTag(target: unknown): string {
    return this.resolver.resolveMergeTag(target)
  }

  lockSnapshot(): void {
    const entry = untracked(() => this._entry())
    if (entry === undefined) return
    this._lockedSnapshot.set(
      this.resolver.resolveWithMeta(
        entry,
        untracked(() => this._selectedOptimizations()),
      ),
    )
  }

  clearSnapshot(): void {
    this._lockedSnapshot.set(undefined)
  }

  ngOnDestroy(): void {
    if (this.manualTrackingActive) {
      this.optimization.sdk?.tracking.clearElement('views', this.elementRef.nativeElement)
      this.manualTrackingActive = false
    }
  }
}
