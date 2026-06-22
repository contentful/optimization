import { Component, inject } from '@angular/core'
import { clickScenarios, pages } from 'e2e-web/src/fixtures'
import { ControlPanel } from '../../components/control-panel'
import { EntryCard } from '../../components/entry-card'
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
  protected readonly autoIds = pages.home.auto
  protected readonly manualIds = pages.home.manual
  protected readonly liveUpdatesEntryId = pages.home.liveUpdates

  protected readonly entries = this.contentfulClient.loadEntries(pages.home.ids)

  protected entryFor(id: string): ContentfulEntry | undefined {
    return this.entries.value()?.get(id)
  }

  protected readonly clickScenarios = clickScenarios
}
