import {
  afterNextRender,
  computed,
  effect,
  ElementRef,
  inject,
  Injectable,
  signal,
  untracked,
  type OnDestroy,
} from '@angular/core'
import type { SelectedOptimizationArray } from '@contentful/optimization-web/api-schemas'
import type { Entry } from 'contentful'
import { NgContentfulLiveUpdates } from './live-updates'
import { NgContentfulOptimization } from './optimization'
import { NgContentfulOptimizationResolver, type ResolvedEntryView } from './optimization-resolver'

@Injectable()
export class NgContentfulLiveEntry implements OnDestroy {
  // injected dependencies
  private readonly resolver = inject(NgContentfulOptimizationResolver)
  private readonly liveUpdates = inject(NgContentfulLiveUpdates)
  private readonly optimization = inject(NgContentfulOptimization)
  private readonly elementRef = inject<ElementRef<Element>>(ElementRef)

  // private state
  private readonly _entry = signal<Entry | undefined>(undefined)
  private readonly _selectedOptimizations = signal<SelectedOptimizationArray | undefined>(undefined)
  private readonly _liveUpdatesOverride = signal<boolean | undefined>(undefined)
  private readonly _lockedSnapshot = signal<ResolvedEntryView | undefined>(undefined)
  private readonly _observation = signal<'auto' | 'manual'>('auto')
  private readonly _domReady = signal(false)
  private manualTrackingActive = false

  // public state
  readonly isLive = computed(() => {
    if (this.liveUpdates.previewPanelVisible()) return true
    const override = this._liveUpdatesOverride()
    if (override !== undefined) return override
    return this.liveUpdates.globalLiveUpdates()
  })

  readonly resolved = computed((): ResolvedEntryView | undefined => {
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

  configure(config: {
    entry: Entry
    selectedOptimizations: SelectedOptimizationArray | undefined
    liveUpdates: boolean | undefined
    observation: 'auto' | 'manual'
  }): void {
    this._entry.set(config.entry)
    this._selectedOptimizations.set(config.selectedOptimizations)
    this._liveUpdatesOverride.set(config.liveUpdates)
    this._observation.set(config.observation)
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
