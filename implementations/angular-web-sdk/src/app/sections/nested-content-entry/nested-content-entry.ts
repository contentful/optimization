import { Component, input } from '@angular/core'
import type { ContentfulEntry } from '../../types/contentful'
import { NestedContentItem } from '../nested-content-item/nested-content-item'

@Component({
  selector: 'app-nested-content-entry',
  imports: [NestedContentItem],
  template: `
    <section [attr.data-testid]="'nested-content-entry-' + entry().sys.id">
      <app-nested-content-item [entry]="entry()" />
    </section>
  `,
})
export class NestedContentEntry {
  readonly entry = input.required<ContentfulEntry>()
}
