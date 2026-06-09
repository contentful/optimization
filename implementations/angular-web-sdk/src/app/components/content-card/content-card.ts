import { Component, input } from '@angular/core'
import { isRecord } from '@contentful/optimization-angular'
import type { SelectedOptimizationArray } from '@contentful/optimization-web/api-schemas'
import type { EntryClickScenario } from '../../config/entries'
import type { ContentfulEntry } from '../../types/contentful'
import { ContentEntry } from '../content-entry/content-entry'
import { NestedContentEntry } from '../nested-content-entry/nested-content-entry'

function isNestedContentEntry(entry: ContentfulEntry): boolean {
  const ct: unknown = entry.sys.contentType
  if (!isRecord(ct) || !isRecord(ct.sys)) return false
  return ct.sys.id === 'nestedContent'
}

@Component({
  selector: 'app-content-card',
  imports: [ContentEntry, NestedContentEntry],
  template: `
    @if (isNested(entry())) {
      <app-nested-content-entry [entry]="entry()" />
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

  protected readonly isNested = isNestedContentEntry
}
