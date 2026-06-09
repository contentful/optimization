import { Component, inject, type OnInit, signal } from '@angular/core'
import {
  NgContentfulClient,
  NgContentfulLiveUpdates,
  NgContentfulOptimization,
} from '@contentful/optimization-angular'
import { ContentCard, ContentEntry } from '../../components/content-card'
import { ControlPanel } from '../../components/control-panel/control-panel'
import { ENTRIES, type EntryClickScenario } from '../../config/entries'
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
  protected readonly liveUpdatesService = inject(NgContentfulLiveUpdates)

  // protected state
  protected readonly loading = signal(true)
  protected readonly entriesById = signal<Map<string, ContentfulEntry>>(new Map())
  protected readonly selectedOptimizations = inject(NgContentfulOptimization).selectedOptimizations
  protected readonly autoIds = ENTRIES.home.auto
  protected readonly manualIds = ENTRIES.home.manual
  protected readonly liveUpdatesEntryId = ENTRIES.home.liveUpdates

  // lifecycle
  ngOnInit(): void {
    void this.loadEntries()
  }

  // public methods
  protected entryFor(id: string): ContentfulEntry | undefined {
    return this.entriesById().get(id)
  }

  protected clickScenario(id: string): EntryClickScenario | undefined {
    return ENTRIES.home.clickScenarios[id]
  }

  // private methods
  private async loadEntries(): Promise<void> {
    const ids = [...new Set([...ENTRIES.home.auto, ...ENTRIES.home.manual])]
    const entries = await this.contentfulClient.fetchEntries(ids)
    const map = new Map<string, ContentfulEntry>()
    for (const entry of entries) {
      map.set(entry.sys.id, entry)
    }
    this.entriesById.set(map)
    this.loading.set(false)
  }
}
