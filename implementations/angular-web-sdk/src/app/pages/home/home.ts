import { Component, inject, resource } from '@angular/core'
import {
  NgContentfulClient,
  NgContentfulLiveUpdates,
  NgContentfulOptimization,
} from '@contentful/optimization-angular'
import { ContentCard, ContentEntry } from '../../components/content-card'
import { ControlPanel } from '../../components/control-panel/control-panel'
import { FIXTURES } from '../../fixtures'
import type { ContentfulEntry } from '../../types/contentful'

@Component({
  selector: 'app-home',
  imports: [ContentCard, ContentEntry, ControlPanel],
  templateUrl: './home.html',
  host: { style: 'display: contents' },
})
export class Home {
  private readonly contentfulClient = inject(NgContentfulClient)
  protected readonly liveUpdatesService = inject(NgContentfulLiveUpdates)
  protected readonly selectedOptimizations = inject(NgContentfulOptimization).selectedOptimizations
  protected readonly autoIds = FIXTURES.home.auto
  protected readonly manualIds = FIXTURES.home.manual
  protected readonly liveUpdatesEntryId = FIXTURES.home.liveUpdates

  private readonly entries = resource({
    loader: async () => {
      const list = await this.contentfulClient.fetchEntries(FIXTURES.home.ids)
      return new Map(list.map((e) => [e.sys.id, e]))
    },
  })

  protected readonly loading = this.entries.isLoading

  protected entryFor(id: string): ContentfulEntry | undefined {
    return this.entries.value()?.get(id)
  }

  protected readonly clickScenarios = FIXTURES.home.clickScenarios
}
