import type { EntryClickScenario } from 'e2e-web'

export type { EntryClickScenario }

export type LiveMode = 'live-on' | 'live-off' | 'live-always-on' | 'live-always-off'
export type MergeTagMode = 'mergetag' | 'mergetag-fallback'

export type BadgeKey =
  | 'variant'
  | 'baseline'
  | 'auto'
  | 'manual'
  | LiveMode
  | MergeTagMode
  | EntryClickScenario

export const BADGE_MAP: Record<BadgeKey, { label: string; title: string }> = {
  variant: {
    label: 'variant',
    title: 'This entry is a variant selected by the optimization SDK',
  },
  baseline: {
    label: 'baseline',
    title: 'This entry is the baseline (no optimization applied)',
  },
  auto: {
    label: 'tracking ↺',
    title:
      'View, click, and hover events fire automatically via data-ctfl-* attributes once consent is granted — content resolution is unaffected',
  },
  manual: {
    label: 'tracking ⚙',
    title:
      'View events fire via explicit enableElement calls; no click or hover events — content resolution is unaffected',
  },
  'live-on': {
    label: 'live ✓',
    title: 'Following global toggle — currently live, re-resolves on profile change',
  },
  'live-off': {
    label: 'live ✗',
    title: 'Following global toggle — currently frozen, will update when toggle is ON',
  },
  'live-always-on': {
    label: '📌 live ✓',
    title: 'Per-entry override: always re-resolves on profile change',
  },
  'live-always-off': {
    label: '📌 live ✗',
    title: 'Per-entry override: ignores the global toggle, does not update on profile change',
  },
  mergetag: {
    label: 'merge tag ✓',
    title: 'Rich text merge tags resolved with visitor profile',
  },
  'mergetag-fallback': {
    label: 'merge tag ✗',
    title: 'Rich text merge tags showing fallback — no visitor profile',
  },
  direct: {
    label: 'direct',
    title: 'Click tracking fires directly on this entry element',
  },
  ancestor: {
    label: 'ancestor',
    title: 'Click tracking fires on an ancestor wrapper element',
  },
  descendant: {
    label: 'descendant',
    title: 'Click tracking fires from a descendant button inside this entry',
  },
}
