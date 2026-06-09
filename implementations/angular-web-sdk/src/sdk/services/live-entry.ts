import { computed, inject, Injectable, signal, untracked } from '@angular/core'
import type { SelectedOptimizationArray } from '@contentful/optimization-web/api-schemas'
import type { Entry } from 'contentful'
import { NgContentfulLiveUpdates } from './live-updates'
import { NgContentfulOptimizationResolver, type ResolvedEntryView } from './optimization-resolver'

@Injectable()
export class NgContentfulLiveEntry {
  private readonly resolver = inject(NgContentfulOptimizationResolver)
  private readonly liveUpdates = inject(NgContentfulLiveUpdates)

  private readonly _entry = signal<Entry | undefined>(undefined)
  private readonly _selectedOptimizations = signal<SelectedOptimizationArray | undefined>(undefined)
  private readonly _liveUpdatesOverride = signal<boolean | undefined>(undefined)
  private readonly _lockedSnapshot = signal<ResolvedEntryView | undefined>(undefined)

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

  setEntry(entry: Entry): void {
    this._entry.set(entry)
  }

  setSelectedOptimizations(value: SelectedOptimizationArray | undefined): void {
    this._selectedOptimizations.set(value)
  }

  setLiveUpdatesOverride(value: boolean | undefined): void {
    this._liveUpdatesOverride.set(value)
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
}
