import { Component, inject } from '@angular/core'
import { RouterLink } from '@angular/router'
import { PAGES } from 'e2e-web'
import { ControlPanel } from '../../components/control-panel'
import { EntryCard } from '../../components/entry-card'
import type { ContentfulEntry } from '../../services/contentful-client'
import { NgContentfulClient } from '../../services/contentful-client'
import { NgContentfulOptimization } from '../../services/optimization'

const PAGE_TWO_COMPONENT_ID = 'page-two-conversion'

@Component({
  selector: 'app-page-two',
  imports: [EntryCard, ControlPanel, RouterLink],
  templateUrl: './index.html',
  host: { style: 'display: contents' },
})
export class PageTwo {
  private readonly optimization = inject(NgContentfulOptimization)
  private readonly contentfulClient = inject(NgContentfulClient)

  protected readonly entries = this.contentfulClient.loadEntries(PAGES.pageTwo.ids)

  protected autoEntry(): ContentfulEntry | undefined {
    return this.entries.value()?.get(PAGES.pageTwo.auto)
  }

  protected manualEntry(): ContentfulEntry | undefined {
    return this.entries.value()?.get(PAGES.pageTwo.manual)
  }

  protected readonly trackConversion = (): void => {
    void this.optimization.sdk.trackView({
      componentId: PAGE_TWO_COMPONENT_ID,
      viewId: crypto.randomUUID(),
      viewDurationMs: 0,
    })
  }
}
