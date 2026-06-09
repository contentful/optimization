import { Component, computed, input } from '@angular/core'
import type { ObservationMode } from '@contentful/optimization-angular'
import type { SelectedOptimizationArray } from '@contentful/optimization-web/api-schemas'
import type { EntryClickScenario } from '../../config/entries'
import type { ContentfulEntry } from '../../types/contentful'
import { ContentEntry } from './entry'
import { NestedContent } from './nested-content'

function isNestedContentEntry(entry: ContentfulEntry): boolean {
  return entry.sys.contentType.sys.id === 'nestedContent'
}

@Component({
  selector: 'app-content-card',
  imports: [ContentEntry, NestedContent],
  template: `
    @if (isNested()) {
      <section [attr.data-testid]="'nested-content-entry-' + entry().sys.id">
        <app-nested-content [entry]="entry()" />
      </section>
    } @else {
      <app-content-entry
        [entry]="entry()"
        [observation]="observation()"
        [clickScenario]="clickScenario()"
        [selectedOptimizations]="selectedOptimizations()"
        [liveUpdates]="liveUpdates()"
      />
    }
  `,
})
export class ContentCard {
  // inputs
  readonly entry = input.required<ContentfulEntry>()
  readonly observation = input<ObservationMode>('auto')
  readonly clickScenario = input<EntryClickScenario | undefined>(undefined)
  readonly selectedOptimizations = input<SelectedOptimizationArray | undefined>(undefined)
  readonly liveUpdates = input<boolean | undefined>(undefined)

  // protected state
  protected readonly isNested = computed(() => isNestedContentEntry(this.entry()))
}

export { EntryBadge } from './badge'
export { ContentEntry } from './entry'
export { NestedContent } from './nested-content'
export { RichText } from './rich-text'
