import type { ObservationMode } from '@contentful/optimization-angular'

export type EntryClickScenario = 'direct' | 'descendant' | 'ancestor'
export type LiveMode = 'default-on' | 'default-off' | 'always-on' | 'always-off'
export type MergeTagMode = 'mergetag' | 'mergetag-fallback'

export type BadgeKey =
  | 'variant'
  | 'baseline'
  | ObservationMode
  | LiveMode
  | MergeTagMode
  | EntryClickScenario

export const BADGE_MAP: Record<BadgeKey, { label: string; mod: string; title: string }> = {
  variant: {
    label: 'variant',
    mod: 'variant',
    title: 'This entry is a variant selected by the optimization SDK',
  },
  baseline: {
    label: 'baseline',
    mod: '',
    title: 'This entry is the baseline (no optimization applied)',
  },
  auto: {
    label: 'auto',
    mod: 'auto',
    title: 'Entry tracking is handled automatically via data attributes',
  },
  manual: {
    label: 'manual',
    mod: 'manual',
    title: 'Entry tracking is triggered manually by the app',
  },
  'default-on': {
    label: 'live',
    mod: 'live-on',
    title: 'Following global toggle — currently live, re-resolves on profile change',
  },
  'default-off': {
    label: 'live',
    mod: 'live-off',
    title: 'Following global toggle — currently frozen, will update when toggle is ON',
  },
  'always-on': {
    label: 'always live',
    mod: 'live-always-on',
    title: 'Per-entry override: always re-resolves on profile change',
  },
  'always-off': {
    label: 'locked',
    mod: 'live-always-off',
    title: 'Per-entry override: ignores the global toggle, does not update on profile change',
  },
  mergetag: {
    label: 'merge tag',
    mod: 'mergetag',
    title: 'Rich text merge tags resolved with visitor profile',
  },
  'mergetag-fallback': {
    label: 'merge tag fallback',
    mod: 'mergetag-fallback',
    title: 'Rich text merge tags showing fallback — no visitor profile',
  },
  direct: {
    label: 'direct',
    mod: 'click',
    title: 'Click tracking fires directly on this entry element',
  },
  ancestor: {
    label: 'ancestor',
    mod: 'click',
    title: 'Click tracking fires on an ancestor wrapper element',
  },
  descendant: {
    label: 'descendant',
    mod: 'click',
    title: 'Click tracking fires from a descendant button inside this entry',
  },
}

const clickScenarios: Record<string, EntryClickScenario> = {
  '4ib0hsHWoSOnCVdDkizE8d': 'direct',
  xFwgG3oNaOcjzWiGe4vXo: 'descendant',
  '2Z2WLOx07InSewC3LUB3eX': 'ancestor',
}

const pageTwoAuto = '2Z2WLOx07InSewC3LUB3eX' as const
const pageTwoManual = '5XHssysWUDECHzKLzoIsg1' as const

const homeAuto = [
  '1JAU028vQ7v6nB2swl3NBo',
  '1MwiFl4z7gkwqGYdvCmr8c',
  '4ib0hsHWoSOnCVdDkizE8d',
  'xFwgG3oNaOcjzWiGe4vXo',
  '2Z2WLOx07InSewC3LUB3eX',
] as const

const homeManual = [
  '5XHssysWUDECHzKLzoIsg1',
  '6zqoWXyiSrf0ja7I2WGtYj',
  '7pa5bOx8Z9NmNcr7mISvD',
] as const

export const FIXTURES = {
  home: {
    ids: [...new Set([...homeAuto, ...homeManual])] as const,
    auto: homeAuto,
    manual: homeManual,
    liveUpdates: '2Z2WLOx07InSewC3LUB3eX' as const,
    clickScenarios,
  },
  pageTwo: {
    ids: [pageTwoAuto, pageTwoManual] as const,
    auto: pageTwoAuto,
    manual: pageTwoManual,
  },
} as const
