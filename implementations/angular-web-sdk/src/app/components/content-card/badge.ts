import { Component, input } from '@angular/core'
import type { ObservationMode } from '@contentful/optimization-angular'
import type { EntryClickScenario } from '../../fixtures'
import type { RichTextDocument } from '../../types/contentful'

export interface Badge {
  label: string
  mod: string
  title: string
}

const OBSERVATION_TITLES: Record<ObservationMode, string> = {
  auto: 'Entry tracking is handled automatically via data attributes',
  manual: 'Entry tracking is triggered manually by the app',
}

const CLICK_SCENARIO_TITLES: Record<EntryClickScenario, string> = {
  direct: 'Click tracking fires directly on this entry element',
  ancestor: 'Click tracking fires on an ancestor wrapper element',
  descendant: 'Click tracking fires from a descendant button inside this entry',
}

export function buildEntryBadges(
  isVariant: boolean,
  obs: ObservationMode,
  rt: RichTextDocument | undefined,
  scenario: EntryClickScenario | undefined,
): Badge[] {
  const tags: Badge[] = [
    {
      label: isVariant ? 'variant' : 'baseline',
      mod: isVariant ? 'variant' : '',
      title: isVariant
        ? 'This entry is a variant selected by the optimization SDK'
        : 'This entry is the baseline (no optimization applied)',
    },
    { label: obs, mod: obs, title: OBSERVATION_TITLES[obs] },
  ]
  if (rt)
    tags.push({ label: 'rich text', mod: 'richtext', title: 'Entry contains a rich text field' })
  if (rt && JSON.stringify(rt).includes('"nt_mergetag"'))
    tags.push({
      label: 'merge tag',
      mod: 'mergetag',
      title: 'Rich text contains merge tag entries that are resolved at render time',
    })
  if (scenario) tags.push({ label: scenario, mod: 'click', title: CLICK_SCENARIO_TITLES[scenario] })
  return tags
}

export function buildNestedBadges(isVariant: boolean): Badge[] {
  return [
    {
      label: isVariant ? 'variant' : 'baseline',
      mod: isVariant ? 'variant' : '',
      title: isVariant
        ? 'This entry is a variant selected by the optimization SDK'
        : 'This entry is the baseline (no optimization applied)',
    },
    {
      label: 'auto',
      mod: 'auto',
      title: 'Entry tracking is handled automatically via data attributes',
    },
    {
      label: 'nested',
      mod: 'nested',
      title: 'This entry is a nested child resolved via the optimization resolver',
    },
  ]
}

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
