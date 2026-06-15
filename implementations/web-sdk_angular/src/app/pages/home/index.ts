import { Component, inject } from '@angular/core'
import { ControlPanel } from '../../components/control-panel'
import { EntryCard } from '../../components/entry-card'
import { FIXTURES } from '../../fixtures'
import type { ContentfulEntry } from '../../services/contentful-client'
import { NgContentfulClient } from '../../services/contentful-client'
import { NgLiveUpdates } from '../../services/live-updates'

@Component({
  selector: 'app-home',
  imports: [EntryCard, ControlPanel],
  templateUrl: './index.html',
  host: { style: 'display: contents' },
})
export class Home {
  private readonly contentfulClient = inject(NgContentfulClient)
  protected readonly liveUpdatesService = inject(NgLiveUpdates)
  protected readonly autoIds = FIXTURES.home.auto
  protected readonly manualIds = FIXTURES.home.manual
  protected readonly liveUpdatesEntryId = FIXTURES.home.liveUpdates

  protected readonly entries = this.contentfulClient.loadEntries(FIXTURES.home.ids)

  protected entryFor(id: string): ContentfulEntry | undefined {
    return this.entries.value()?.get(id)
  }

  protected readonly clickScenarios = FIXTURES.home.clickScenarios
}
