import { Component, inject, type OnInit, signal } from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import type { SelectedOptimizationArray } from '@contentful/optimization-web/api-schemas'
import { Observable } from 'rxjs'
import { ControlPanel } from '../../components/control-panel/control-panel'
import { PAGE_TWO_AUTO_ENTRY_ID, PAGE_TWO_MANUAL_ENTRY_ID } from '../../config/entries'
import { fromSdkObservable, Optimization } from '../../optimization/optimization'
import { ContentEntry } from '../../sections/content-entry/content-entry'
import { ContentfulClient } from '../../services/contentful-client'
import type { ContentfulEntry } from '../../types/contentful'

const PAGE_TWO_COMPONENT_ID = 'page-two-conversion'

@Component({
  selector: 'app-page-two',
  imports: [ContentEntry, ControlPanel],
  templateUrl: './page-two.html',
})
export class PageTwo implements OnInit {
  private readonly optimization = inject(Optimization)
  private readonly contentfulClient = inject(ContentfulClient)

  protected readonly loading = signal(true)
  protected readonly autoEntry = signal<ContentfulEntry | undefined>(undefined)
  protected readonly manualEntry = signal<ContentfulEntry | undefined>(undefined)

  protected readonly selectedOptimizations = toSignal(
    this.optimization.sdk !== undefined
      ? fromSdkObservable<SelectedOptimizationArray | undefined>(
          this.optimization.sdk.states.selectedOptimizations,
        )
      : new Observable<SelectedOptimizationArray | undefined>((sub) => {
          sub.next(undefined)
        }),
  )

  ngOnInit(): void {
    this.trackArrival()
    void this.loadEntries()
  }

  protected trackConversion(): void {
    void this.optimization.sdk?.trackView({
      componentId: PAGE_TWO_COMPONENT_ID,
      viewId: crypto.randomUUID(),
      viewDurationMs: 0,
    })
  }

  private trackArrival(): void {
    this.trackConversion()
  }

  private async loadEntries(): Promise<void> {
    const ids = [...new Set([PAGE_TWO_AUTO_ENTRY_ID, PAGE_TWO_MANUAL_ENTRY_ID])]
    const entries = await this.contentfulClient.fetchEntries(ids)
    const byId = new Map(entries.map((e) => [e.sys.id, e]))
    this.autoEntry.set(byId.get(PAGE_TWO_AUTO_ENTRY_ID))
    this.manualEntry.set(byId.get(PAGE_TWO_MANUAL_ENTRY_ID))
    this.loading.set(false)
  }
}
