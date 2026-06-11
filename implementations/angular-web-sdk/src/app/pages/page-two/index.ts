import { Component, inject, resource } from '@angular/core'
import { NgContentfulClient, NgContentfulOptimization } from '@contentful/optimization-angular'
import { ContentCard } from '../../components/content-card'
import { ControlPanel } from '../../components/control-panel'
import { FIXTURES } from '../../fixtures'
import type { ContentfulEntry } from '../../types/contentful'

const PAGE_TWO_COMPONENT_ID = 'page-two-conversion'

@Component({
  selector: 'app-page-two',
  imports: [ContentCard, ControlPanel],
  templateUrl: './index.html',
  host: { style: 'display: contents' },
})
export class PageTwo {
  private readonly optimization = inject(NgContentfulOptimization)
  private readonly contentfulClient = inject(NgContentfulClient)

  protected readonly entries = resource({
    loader: async (): Promise<Map<string, ContentfulEntry>> => {
      const list = await this.contentfulClient.fetchEntries(FIXTURES.pageTwo.ids)
      return new Map(list.map((e) => [e.sys.id, e]))
    },
  })

  protected autoEntry(): ContentfulEntry | undefined {
    return this.entries.value()?.get(FIXTURES.pageTwo.auto)
  }

  protected manualEntry(): ContentfulEntry | undefined {
    return this.entries.value()?.get(FIXTURES.pageTwo.manual)
  }

  protected readonly trackConversion = (): void => {
    void this.optimization.sdk.trackView({
      componentId: PAGE_TWO_COMPONENT_ID,
      viewId: crypto.randomUUID(),
      viewDurationMs: 0,
    })
  }
}
