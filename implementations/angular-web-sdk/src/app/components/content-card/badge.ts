import { Component, input } from '@angular/core'

@Component({
  selector: 'app-entry-badge',
  template: `<span
    [class]="mod() ? 'entry-card__badge entry-card__badge--' + mod() : 'entry-card__badge'"
    [attr.data-tooltip]="title()"
    >{{ label() }}</span
  >`,
})
export class EntryBadge {
  readonly label = input.required<string>()
  readonly mod = input<string>('')
  readonly title = input<string>('')
}
