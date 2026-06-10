import { Component, input } from '@angular/core'
import type { ObservationMode } from '@contentful/optimization-angular'
import type { EntryClickScenario } from '../../fixtures'

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

export interface EntryBadgeOptions {
  isVariant: boolean
  obs: ObservationMode
  hasRichText: boolean
  mergeTagResolved: boolean | undefined
  scenario: EntryClickScenario | undefined
}

export function buildEntryBadges({
  isVariant,
  obs,
  hasRichText,
  mergeTagResolved,
  scenario,
}: EntryBadgeOptions): Badge[] {
  const badges: Badge[] = [
    {
      label: isVariant ? 'variant' : 'baseline',
      mod: isVariant ? 'variant' : '',
      title: isVariant
        ? 'This entry is a variant selected by the optimization SDK'
        : 'This entry is the baseline (no optimization applied)',
    },
    { label: obs, mod: obs, title: OBSERVATION_TITLES[obs] },
  ]
  if (hasRichText)
    badges.push({ label: 'rich text', mod: 'richtext', title: 'Entry contains a rich text field' })
  if (mergeTagResolved === true)
    badges.push({
      label: 'merge tag',
      mod: 'mergetag',
      title: 'Rich text merge tags resolved with visitor profile',
    })
  if (mergeTagResolved === false)
    badges.push({
      label: 'merge tag fallback',
      mod: 'mergetag-fallback',
      title: 'Rich text merge tags showing fallback — no visitor profile',
    })
  if (scenario)
    badges.push({ label: scenario, mod: 'click', title: CLICK_SCENARIO_TITLES[scenario] })
  return badges
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
