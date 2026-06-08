import { Component, computed, inject, type OnInit, signal } from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import type { SelectedOptimizationArray } from '@contentful/optimization-web/api-schemas'
import { Observable } from 'rxjs'
import { AUTO_OBSERVED_ENTRY_IDS, MANUALLY_OBSERVED_ENTRY_IDS } from '../../config/entries'
import { fromSdkObservable, Optimization } from '../../optimization/optimization'
import { ContentEntry, type EntryClickScenario } from '../../sections/content-entry/content-entry'
import { ContentfulClient } from '../../services/contentful-client'
import type { ContentfulEntry } from '../../types/contentful'

const CLICK_SCENARIO_BY_ENTRY_ID: Readonly<Record<string, EntryClickScenario>> = {
  '4ib0hsHWoSOnCVdDkizE8d': 'direct',
  xFwgG3oNaOcjzWiGe4vXo: 'descendant',
  '2Z2WLOx07InSewC3LUB3eX': 'ancestor',
}

@Component({
  selector: 'app-home',
  imports: [ContentEntry],
  templateUrl: './home.html',
})
export class Home implements OnInit {
  private readonly contentfulClient = inject(ContentfulClient)
  private readonly optimization = inject(Optimization)

  protected readonly entriesById = signal<Map<string, ContentfulEntry>>(new Map())
  protected readonly loading = signal(true)

  protected readonly consent = toSignal(this.optimization.consent$)

  protected readonly selectedOptimizations = toSignal(
    this.optimization.sdk !== undefined
      ? fromSdkObservable<SelectedOptimizationArray | undefined>(
          this.optimization.sdk.states.selectedOptimizations,
        )
      : new Observable<SelectedOptimizationArray | undefined>((sub) => {
          sub.next(undefined)
        }),
  )

  protected readonly autoIds = AUTO_OBSERVED_ENTRY_IDS
  protected readonly manualIds = MANUALLY_OBSERVED_ENTRY_IDS

  protected readonly selectedOptimizationCount = computed(
    () => this.selectedOptimizations()?.length ?? 0,
  )

  protected entryFor(id: string): ContentfulEntry | undefined {
    return this.entriesById().get(id)
  }

  protected clickScenario(id: string): EntryClickScenario | undefined {
    return CLICK_SCENARIO_BY_ENTRY_ID[id]
  }

  protected toggleConsent(): void {
    this.optimization.setConsent(this.consent() !== true)
  }

  ngOnInit(): void {
    void this.loadEntries()
  }

  private async loadEntries(): Promise<void> {
    const allIds = [...AUTO_OBSERVED_ENTRY_IDS, ...MANUALLY_OBSERVED_ENTRY_IDS]
    const entries = await this.contentfulClient.fetchEntries(allIds)
    const map = new Map<string, ContentfulEntry>()
    for (const entry of entries) {
      map.set(entry.sys.id, entry)
    }
    this.entriesById.set(map)
    this.loading.set(false)
  }
}
