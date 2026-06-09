import { Component, inject, type OnInit, signal } from '@angular/core'
import { NgContentfulClient, NgContentfulOptimization } from '@contentful/optimization-angular'
import { ContentEntry } from '../../components/content-card'
import { ControlPanel } from '../../components/control-panel/control-panel'
import { FIXTURES } from '../../fixtures'
import type { ContentfulEntry } from '../../types/contentful'

const PAGE_TWO_COMPONENT_ID = 'page-two-conversion'

@Component({
  selector: 'app-page-two',
  imports: [ContentEntry, ControlPanel],
  templateUrl: './page-two.html',
  host: { style: 'display: contents' },
})
export class PageTwo implements OnInit {
  // injected dependencies
  private readonly optimization = inject(NgContentfulOptimization)
  private readonly contentfulClient = inject(NgContentfulClient)

  // protected state
  protected readonly loading = signal(true)
  protected readonly autoEntry = signal<ContentfulEntry | undefined>(undefined)
  protected readonly manualEntry = signal<ContentfulEntry | undefined>(undefined)
  protected readonly selectedOptimizations = this.optimization.selectedOptimizations

  // lifecycle
  ngOnInit(): void {
    this.trackConversion()
    void this.loadEntries()
  }

  // public methods
  protected trackConversion(): void {
    void this.optimization.sdk?.trackView({
      componentId: PAGE_TWO_COMPONENT_ID,
      viewId: crypto.randomUUID(),
      viewDurationMs: 0,
    })
  }

  // private methods
  private async loadEntries(): Promise<void> {
    const ids = [FIXTURES.pageTwo.auto, FIXTURES.pageTwo.manual]
    const entries = await this.contentfulClient.fetchEntries(ids)
    const byId = new Map(entries.map((e) => [e.sys.id, e]))
    this.autoEntry.set(byId.get(FIXTURES.pageTwo.auto))
    this.manualEntry.set(byId.get(FIXTURES.pageTwo.manual))
    this.loading.set(false)
  }
}
