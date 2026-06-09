import { Component, computed, input } from '@angular/core'
import { isRecord } from '@contentful/optimization-angular'
import type { SelectedOptimizationArray } from '@contentful/optimization-web/api-schemas'
import type { EntryClickScenario } from '../../config/entries'
import type { ContentfulEntry } from '../../types/contentful'
import { ContentEntry } from './content-entry'
import { NestedContentItem } from './nested-content-item'

function isNestedContentEntry(entry: ContentfulEntry): boolean {
  const ct: unknown = entry.sys.contentType
  if (!isRecord(ct) || !isRecord(ct.sys)) return false
  return ct.sys.id === 'nestedContent'
}

@Component({
  selector: 'app-content-card',
  imports: [ContentEntry, NestedContentItem],
  template: `
    @if (isNested()) {
      <section [attr.data-testid]="'nested-content-entry-' + entry().sys.id">
        <app-nested-content-item [entry]="entry()" />
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
  readonly entry = input.required<ContentfulEntry>()
  readonly observation = input<'auto' | 'manual'>('auto')
  readonly clickScenario = input<EntryClickScenario | undefined>(undefined)
  readonly selectedOptimizations = input<SelectedOptimizationArray | undefined>(undefined)
  readonly liveUpdates = input<boolean | undefined>(undefined)

  protected readonly isNested = computed(() => isNestedContentEntry(this.entry()))
}
