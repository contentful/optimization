import { Component, inject, type OnInit, signal } from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import {
  NgContentfulClient,
  NgContentfulLiveUpdates,
  NgContentfulOptimization,
} from '@contentful/optimization-angular'
import { ContentCard } from '../../components/content-card/content-card'
import { ContentEntry } from '../../components/content-entry/content-entry'
import { ControlPanel } from '../../components/control-panel/control-panel'
import {
  ALL_ENTRY_IDS,
  AUTO_OBSERVED_ENTRY_IDS,
  CLICK_SCENARIO_BY_ENTRY_ID,
  type EntryClickScenario,
  LIVE_UPDATES_ENTRY_ID,
  MANUALLY_OBSERVED_ENTRY_IDS,
} from '../../config/entries'
import type { ContentfulEntry } from '../../types/contentful'

@Component({
  selector: 'app-home',
  imports: [ContentCard, ContentEntry, ControlPanel],
  templateUrl: './home.html',
  host: { style: 'display: contents' },
})
export class Home implements OnInit {
  // injected dependencies
  private readonly contentfulClient = inject(NgContentfulClient)
  private readonly optimization = inject(NgContentfulOptimization)
  protected readonly liveUpdatesService = inject(NgContentfulLiveUpdates)

  // state
  protected readonly loading = signal(true)
  protected readonly entriesById = signal<Map<string, ContentfulEntry>>(new Map())
  protected readonly selectedOptimizations = toSignal(this.optimization.selectedOptimizations$)

  // config
  protected readonly autoIds = AUTO_OBSERVED_ENTRY_IDS
  protected readonly manualIds = MANUALLY_OBSERVED_ENTRY_IDS
  protected readonly liveUpdatesEntryId = LIVE_UPDATES_ENTRY_ID

  // lifecycle
  ngOnInit(): void {
    void this.loadEntries()
  }

  // public methods
  protected entryFor(id: string): ContentfulEntry | undefined {
    return this.entriesById().get(id)
  }

  protected clickScenario(id: string): EntryClickScenario | undefined {
    return CLICK_SCENARIO_BY_ENTRY_ID[id]
  }

  // private methods
  private async loadEntries(): Promise<void> {
    const entries = await this.contentfulClient.fetchEntries(ALL_ENTRY_IDS)
    const map = new Map<string, ContentfulEntry>()
    for (const entry of entries) {
      map.set(entry.sys.id, entry)
    }
    this.entriesById.set(map)
    this.loading.set(false)
  }
}
