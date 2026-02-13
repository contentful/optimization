import type Optimization from '@contentful/optimization-web'
import type {
  AudienceEntrySkeleton,
  OptimizationData,
  PersonalizationEntry,
  PersonalizationEntrySkeleton,
  SelectedPersonalizationArray,
} from '@contentful/optimization-web'
import type { ChainModifiers, ContentfulClientApi, Entry } from 'contentful'
import {
  CTFL_OPT_PREVIEW_PERSONALIZATION_CHANGE,
  defineCtflOptPreviewAudience,
} from './components/ctfl-opt-preview-audience'
import { defineCtflOptPreviewIndicator } from './components/ctfl-opt-preview-indicator'
import {
  CTFL_OPT_PREVIEW_PANEL_RESET,
  CTFL_OPT_PREVIEW_PANEL_TAG,
  defineCtflOptPreviewPanel,
  isCtflOptPreviewPanel,
} from './components/ctfl-opt-preview-panel'
import {
  defineCtflOptPreviewPersonalization,
  isRecordRadioGroupChangeEvent,
} from './components/ctfl-opt-preview-personalization'
import { getAllEntries, isAudienceEntry, isPersonalizationEntry } from './lib/entries'
import { applyPersonalizationOverrides } from './lib/overrides'

declare global {
  interface Window {
    /** Global nonce value used by the Lit framework */
    litNonce?: string
    /** Global OptimizationPreviewPanel class constructor. */
    attachOptimizationPreviewPanel?: typeof attachOptimizationPreviewPanel
  }
}

let defaults: SelectedPersonalizationArray = []
const overrides = new Map<string, number>()

function canDefineComponents(): void {
  const existing = document.querySelector(CTFL_OPT_PREVIEW_PANEL_TAG)

  if (existing)
    throw new Error('[Optimization Preview Panel] The preview panel has already been attached')
}

interface AttachOptimizationPreviewPanelArgs {
  contentful: ContentfulClientApi<ChainModifiers>
  optimization: Optimization
  nonce: string | undefined
}

export default async function attachOptimizationPreviewPanel({
  contentful,
  optimization,
  nonce,
}: AttachOptimizationPreviewPanelArgs): Promise<void> {
  canDefineComponents()

  if (nonce !== undefined) window.litNonce = nonce

  const { signals, signalFns } = optimization.registerPreviewPanel()
  if (!signals || !signalFns)
    throw new Error(
      '[Optimization Preview Panel] The preview panel failed to find optimization states',
    )

  const [audiences, personalizations]: [Entry[], Entry[]] = await Promise.all([
    getAllEntries<AudienceEntrySkeleton>(contentful, 'nt_audience'),
    getAllEntries<PersonalizationEntrySkeleton>(contentful, 'nt_experience'),
  ])

  defineCtflOptPreviewIndicator()
  defineCtflOptPreviewPersonalization()
  defineCtflOptPreviewAudience()
  defineCtflOptPreviewPanel()

  const panel = document.createElement(CTFL_OPT_PREVIEW_PANEL_TAG)
  if (!isCtflOptPreviewPanel(panel))
    throw new Error(
      '[Optimization Preview Panel] The preview panel cannot be initialized; contact support',
    )

  panel.overrides = overrides
  panel.audiences = audiences.filter(isAudienceEntry)
  panel.personalizations = personalizations.filter(
    (personalization): personalization is PersonalizationEntry =>
      isPersonalizationEntry(personalization) &&
      !personalization.fields.nt_config?.components?.some(
        (component) => component.type === 'InlineVariable',
      ),
  )

  optimization.interceptors.state.add((states): OptimizationData => {
    const { personalizations: selectedPersonalizations, ...otherStates } = states

    defaults = [...selectedPersonalizations]
    panel.defaultSelectedPersonalizations = defaults

    return {
      ...otherStates,
      personalizations: applyPersonalizationOverrides(selectedPersonalizations, overrides),
    }
  })

  panel.addEventListener(CTFL_OPT_PREVIEW_PERSONALIZATION_CHANGE, (event: Event) => {
    if (!isRecordRadioGroupChangeEvent(event)) return

    const {
      detail: { key: experienceId, value: variantIndex },
    } = event
    overrides.set(experienceId, variantIndex)
    signals.personalizations.value = applyPersonalizationOverrides(
      signals.personalizations.value ?? [],
      overrides,
    )
  })

  panel.addEventListener(CTFL_OPT_PREVIEW_PANEL_RESET, () => {
    overrides.clear()
    signals.personalizations.value = [...defaults]
    panel.defaultSelectedPersonalizations = [...defaults]
  })

  signalFns.effect(() => {
    const {
      profile: { value: profile },
    } = signals
    if (profile) panel.profile = profile
  })

  document.body.appendChild(panel)
}
