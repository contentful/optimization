import { Component, inject, type OnInit, signal } from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import {
  NgContentfulClient,
  NgContentfulLiveUpdates,
  NgContentfulOptimization,
} from '@contentful/optimization-angular'
import { ContentEntry, type EntryClickScenario } from '../../components/content-entry/content-entry'
import { ControlPanel } from '../../components/control-panel/control-panel'
import { NestedContentEntry } from '../../components/nested-content-entry/nested-content-entry'
import {
  AUTO_OBSERVED_ENTRY_IDS,
  LIVE_UPDATES_ENTRY_ID,
  MANUALLY_OBSERVED_ENTRY_IDS,
} from '../../config/entries'
import type { ContentfulEntry } from '../../types/contentful'
import { isRecord } from '../../utils/type-guards'

function isNestedContentEntry(entry: ContentfulEntry): boolean {
  const ct: unknown = entry.sys.contentType
  if (!isRecord(ct) || !isRecord(ct.sys)) return false
  return ct.sys.id === 'nestedContent'
}

const CLICK_SCENARIO_BY_ENTRY_ID: Readonly<Record<string, EntryClickScenario>> = {
  '4ib0hsHWoSOnCVdDkizE8d': 'direct',
  xFwgG3oNaOcjzWiGe4vXo: 'descendant',
  '2Z2WLOx07InSewC3LUB3eX': 'ancestor',
}

@Component({
  selector: 'app-home',
  imports: [ContentEntry, NestedContentEntry, ControlPanel],
  templateUrl: './home.html',
  host: { style: 'display: contents' },
})
export class Home implements OnInit {
  private readonly contentfulClient = inject(NgContentfulClient)
  private readonly optimization = inject(NgContentfulOptimization)
  protected readonly liveUpdatesService = inject(NgContentfulLiveUpdates)

  protected readonly entriesById = signal<Map<string, ContentfulEntry>>(new Map())
  protected readonly loading = signal(true)

  protected readonly selectedOptimizations = toSignal(this.optimization.selectedOptimizations$)

  protected readonly autoIds = AUTO_OBSERVED_ENTRY_IDS
  protected readonly manualIds = MANUALLY_OBSERVED_ENTRY_IDS
  protected readonly liveUpdatesEntryId = LIVE_UPDATES_ENTRY_ID

  protected entryFor(id: string): ContentfulEntry | undefined {
    return this.entriesById().get(id)
  }

  protected clickScenario(id: string): EntryClickScenario | undefined {
    return CLICK_SCENARIO_BY_ENTRY_ID[id]
  }

  protected isNested(entry: ContentfulEntry): boolean {
    return isNestedContentEntry(entry)
  }

  ngOnInit(): void {
    void this.loadEntries()
  }

  private async loadEntries(): Promise<void> {
    const allIds = [
      ...AUTO_OBSERVED_ENTRY_IDS,
      ...MANUALLY_OBSERVED_ENTRY_IDS,
      LIVE_UPDATES_ENTRY_ID,
    ]
    const unique = [...new Set(allIds)]
    const entries = await this.contentfulClient.fetchEntries(unique)
    const map = new Map<string, ContentfulEntry>()
    for (const entry of entries) {
      map.set(entry.sys.id, entry)
    }
    this.entriesById.set(map)
    this.loading.set(false)
  }
}
