import type {
  AudienceEntry,
  AudienceEntrySkeleton,
  LifecycleInterceptors,
  Optimization,
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
  type CtflOptPreviewPanel,
  defineCtflOptPreviewPanel,
  isCtflOptPreviewPanel,
} from './components/ctfl-opt-preview-panel'
import {
  defineCtflOptPreviewPersonalization,
  isRecordRadioGroupChangeEvent,
} from './components/ctfl-opt-preview-personalization'
import { getAllEntries } from './lib/getAllEntries'

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

function isAudienceEntry(audience: Entry): audience is AudienceEntry {
  return audience.sys.contentType.sys.id === 'nt_audience'
}

function isPersonalizationEntry(personalization: Entry): personalization is PersonalizationEntry {
  return personalization.sys.contentType.sys.id === 'nt_experience'
}

function canDefineComponents(): void {
  const existing = document.querySelector(CTFL_OPT_PREVIEW_PANEL_TAG)

  if (existing)
    throw new Error('[Optimization Preview Panel] The preview panel has already been attached')
}

function applyPersonalizationOverrides(
  selectedPersonalizations: SelectedPersonalizationArray,
  overrides: Map<string, number>,
): SelectedPersonalizationArray {
  const overriddenPersonalizations = [...selectedPersonalizations]

  for (const [changeExperienceId, changeVariantIndex] of overrides) {
    const change = { experienceId: changeExperienceId, variantIndex: changeVariantIndex }

    const selectedIndex = overriddenPersonalizations.findIndex(
      (selected) => selected.experienceId === change.experienceId,
    )

    if (selectedIndex >= 0) {
      const selected = overriddenPersonalizations.at(selectedIndex)

      if (!selected) continue

      overriddenPersonalizations[selectedIndex] = { ...selected, ...change }
    } else {
      overriddenPersonalizations.push({ ...change, variants: {} })
    }
  }

  return overriddenPersonalizations
}

type PreviewInterceptor = (
  panel: CtflOptPreviewPanel,
  manager: LifecycleInterceptors['state'],
  overrides: Map<string, number>,
) => number

const registerPreviewInterceptor: PreviewInterceptor = (
  panel: CtflOptPreviewPanel,
  manager,
  overrides,
) =>
  manager.add((states): OptimizationData => {
    const { personalizations: selectedPersonalizations, ...otherStates } = states

    defaults = [...selectedPersonalizations]
    panel.defaultSelectedPersonalizations = defaults

    return {
      ...otherStates,
      personalizations: applyPersonalizationOverrides(selectedPersonalizations, overrides),
    }
  })

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

  if (nonce !== undefined) {
    window.litNonce = nonce
  }

  const { signals, signalFns } = optimization.registerPreviewPanel()

  if (signals === undefined || signalFns === undefined || signals === null || signalFns === null)
    throw new Error(
      '[Optimization Preview Panel] The preview panel failed to find optimization states',
    )

  const [audiences, personalizations]: [audiences: Entry[], personalizations: Entry[]] =
    await Promise.all([
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
  panel.audiences = audiences.filter((audience) => isAudienceEntry(audience))
  panel.personalizations = personalizations
    .filter((personalization) => isPersonalizationEntry(personalization))
    // TODO: Support custom flags
    .filter(
      (personalization) =>
        isPersonalizationEntry(personalization) &&
        !personalization.fields.nt_config?.components?.some(
          (component) => component.type === 'InlineVariable',
        ),
    )

  registerPreviewInterceptor(panel, optimization.interceptors.state, overrides)

  panel.addEventListener(CTFL_OPT_PREVIEW_PERSONALIZATION_CHANGE, (event: Event) => {
    if (!isRecordRadioGroupChangeEvent(event)) return

    const {
      detail: { key: changeExperienceId, value: changeVariantIndex },
    } = event

    overrides.set(changeExperienceId, changeVariantIndex)

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

    if (!profile) return

    panel.profile = profile
  })

  document.body.appendChild(panel)
}
