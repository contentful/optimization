import { Component, inject, resource } from '@angular/core'
import { ContentCard } from '../../components/content-card'
import { ControlPanel } from '../../components/control-panel'
import { FIXTURES } from '../../fixtures'
import type { ContentfulEntry } from '../../services/contentful-client'
import { NgContentfulClient } from '../../services/contentful-client'
import { NgContentfulLiveUpdates } from '../../services/live-updates'

@Component({
  selector: 'app-home',
  imports: [ContentCard, ControlPanel],
  templateUrl: './index.html',
  host: { style: 'display: contents' },
})
export class Home {
  private readonly contentfulClient = inject(NgContentfulClient)
  protected readonly liveUpdatesService = inject(NgContentfulLiveUpdates)
  protected readonly autoIds = FIXTURES.home.auto
  protected readonly manualIds = FIXTURES.home.manual
  protected readonly liveUpdatesEntryId = FIXTURES.home.liveUpdates

  protected readonly entries = resource({
    loader: async () => {
      const list = await this.contentfulClient.fetchEntries(FIXTURES.home.ids)
      return new Map(list.map((e) => [e.sys.id, e]))
    },
  })

  protected entryFor(id: string): ContentfulEntry | undefined {
    return this.entries.value()?.get(id)
  }

  protected readonly clickScenarios = FIXTURES.home.clickScenarios
}
